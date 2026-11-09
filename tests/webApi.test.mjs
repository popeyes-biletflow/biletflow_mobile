import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com';
process.env.EXPO_PUBLIC_API_MODE = 'web';
const configSource = await readFile(new URL('../src/apiConfig.js', import.meta.url), 'utf8');
const configUrl = `data:text/javascript;base64,${Buffer.from(configSource).toString('base64')}`;
const config = await import(configUrl);
const apiSource = (await readFile(new URL('../src/adminApi.js', import.meta.url), 'utf8')).replace('"./apiConfig"', JSON.stringify(configUrl));
const api = await import(`data:text/javascript;base64,${Buffer.from(apiSource).toString('base64')}`);
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com'; delete globalThis.__DEV__; });
const profile = { id: 'u1', email: 'staff@example.com', role: 'event_admin' };
let calls;
function mock(responses) {
  calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    const response = responses.shift();
    assert.ok(response, `Unexpected request: ${url}`);
    return { ok: (response.status || 200) < 400, status: response.status || 200, text: async () => JSON.stringify(response.body) };
  };
}
test('web login uses real route and snake_case access_token', async () => {
  mock([{ body: { access_token: 'jwt', refresh_token: 'refresh' } }]);
  assert.equal(await api.signIn('a@b.com', 'password'), 'jwt');
  assert.equal(calls[0].url, 'https://api.example.com/api/auth/login');
});
test('web events require a staff profile and normalize the public array', async () => {
  mock([{ body: profile }, { body: [{ id: 12, title: 'Concert', starts_at: '2026-12-01', venue_name: 'Hall' }] }]);
  assert.deepEqual(await api.getAvailableEvents('jwt'), [{ id: '12', name: 'Concert', startsAt: '2026-12-01', venue: 'Hall' }]);
  assert.equal(calls[0].url, 'https://api.example.com/api/users/me');
  assert.equal(calls[1].url, 'https://api.example.com/api/events');
  assert.equal(calls[1].options.headers.Authorization, 'Bearer jwt');
  assert.equal(api.API_CAPABILITIES.assignedEvents, false);
});
test('QR verify maps qr_payload, ticket_id and sends bearer token', async () => {
  mock([{ body: profile }, { body: { valid: true, message: 'Check-in successful', ticket_id: 't1' } }]);
  const result = await api.validateTicket('jwt', 'e1', 't1:e1:u1:9999999999:signature');
  assert.equal(result.ticketId, 't1');
  assert.equal(calls[1].url, 'https://api.example.com/api/tickets/verify');
  assert.deepEqual(JSON.parse(calls[1].options.body), { qr_payload: 't1:e1:u1:9999999999:signature' });
  assert.equal(calls[1].options.headers.Authorization, 'Bearer jwt');
});
test('foreign-event and malformed QR never call a mutating endpoint', async () => {
  mock([]);
  assert.equal((await api.validateTicket('jwt', 'e2', 't1:e1:u1:9999999999:sig')).valid, false);
  assert.equal((await api.validateTicket('jwt', 'e1', 'broken')).valid, false);
  assert.equal(calls.length, 0);
});
test('attendee or missing staff role cannot scan through the client', async () => {
  for (const role of ['attendee', null]) {
    mock([{ body: { ...profile, role } }]);
    await assert.rejects(api.validateTicket('jwt', 'e1', 't1:e1:u1:9999999999:sig'), (error) => error.status === 403);
    assert.equal(calls.length, 1);
  }
});
test('FastAPI rejection detail is preserved as invalid ticket result', async () => {
  mock([{ body: profile }, { status: 409, body: { detail: 'Ticket has already been used.' } }]);
  assert.deepEqual(await api.validateTicket('jwt', 'e1', 't1:e1:u1:9999999999:sig'), {
    valid: false, ticketId: null, message: 'Ticket has already been used.'
  });
});
test('unsupported operations fail explicitly without hitting nonexistent or SQLite routes', async () => {
  mock([]);
  for (const action of [() => api.getAttendance('jwt', 'e1'), () => api.getAttendees('jwt', 'e1'),
    () => api.checkInAttendee('jwt', 'e1', 't1'), () => api.undoCheckIn('jwt', 'e1', 't1')]) {
    await assert.rejects(action(), (error) => error.code === 'UNSUPPORTED_OPERATION');
  }
  assert.equal(calls.length, 0);
});
test('connection check verifies session and selected event without inventing attendance data', async () => {
  mock([{ body: profile }, { body: { id: 'e1' } }]);
  assert.equal(await api.getEventConnection('jwt', 'e1'), undefined);
  assert.equal(calls[1].url, 'https://api.example.com/api/events/e1');
});
test('local HTTP is development-only; public HTTP and Supabase origins are rejected', () => {
  process.env.EXPO_PUBLIC_API_URL = 'http://192.168.0.157:8000';
  assert.throws(config.getApiBaseUrl, /HTTPS/);
  globalThis.__DEV__ = true;
  assert.equal(config.getApiBaseUrl(), 'http://192.168.0.157:8000');
  process.env.EXPO_PUBLIC_API_URL = 'http://example.com';
  assert.throws(config.getApiBaseUrl, /HTTPS/);
  process.env.EXPO_PUBLIC_API_URL = 'https://project.supabase.co';
  assert.throws(config.getApiBaseUrl, /not the Supabase/);
});
test('origin validation rejects embedded credentials and paths', () => {
  for (const value of ['https://user:pass@example.com', 'https://example.com/api', 'https://example.com?secret=x']) {
    process.env.EXPO_PUBLIC_API_URL = value;
    assert.throws(config.getApiBaseUrl, /origin only/);
  }
});
test('expired web sessions never reach verification', async () => {
  mock([{ status: 401, body: { detail: 'Invalid or expired token.' } }]);
  await assert.rejects(api.validateTicket('jwt', 'e1', 't1:e1:u1:9999999999:sig'), (error) => error.status === 401);
  assert.equal(calls.length, 1);
});
test('FastAPI validation details are readable and malformed verify success is rejected', async () => {
  mock([{ status: 422, body: { detail: [{ loc: ['body', 'email'], msg: 'Field required' }] } }]);
  await assert.rejects(api.signIn('', ''), /Field required/);
  mock([{ body: profile }, { body: null }]);
  await assert.rejects(api.validateTicket('jwt', 'e1', 't1:e1:u1:9999999999:sig'), /ticket-validation response/);
});
