import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const originalFetch = globalThis.fetch;
process.env.EXPO_PUBLIC_API_MODE = 'mobile';
process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com/';
const config = await readFile(new URL('../src/apiConfig.js', import.meta.url), 'utf8');
const configUrl = `data:text/javascript;base64,${Buffer.from(config).toString('base64')}`;
const source = (await readFile(new URL('../src/adminApi.js', import.meta.url), 'utf8')).replace('"./apiConfig"', JSON.stringify(configUrl));
const api = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
afterEach(() => { globalThis.fetch = originalFetch; });
let last;
function respond(body, status = 200) {
  globalThis.fetch = async (url, options) => {
    last = { url, options };
    return { ok: status < 400, status, text: async () => body === undefined ? '' : JSON.stringify(body) };
  };
}
test('search encodes event, name/email/ticket query, and pagination with bearer authentication', async () => {
  respond({ attendees: [{ ticketId: 42, name: 'Alex', email: 'a@b.com', checkedIn: false }], nextCursor: 'page 2' });
  const result = await api.getAttendees('token', 'event/1', 'a+b@b.com', 'page 1');
  assert.equal(result.attendees[0].ticketId, '42');
  assert.equal(result.nextCursor, 'page 2');
  assert.equal(last.url, 'https://api.example.com/api/mobile/events/event%2F1/attendees?search=a%2Bb%40b.com&cursor=page%201&limit=50');
  assert.equal(last.options.headers.Authorization, 'Bearer token');
});
test('undo posts to required endpoint and includes event and ticket scope', async () => {
  respond(undefined, 204);
  await api.undoCheckIn('token', 'e1', 't1');
  assert.equal(last.url, 'https://api.example.com/api/tickets/undo-checkin');
  assert.equal(last.options.method, 'POST');
  assert.deepEqual(JSON.parse(last.options.body), { eventId: 'e1', ticketId: 't1' });
  assert.equal(last.options.headers.Authorization, 'Bearer token');
});
test('authorization rejection and expired sessions are surfaced', async () => {
  respond({}, 403);
  await assert.rejects(api.undoCheckIn('token', 'e1', 't1'), (e) => e.status === 403 && /not authorized/.test(e.message));
  respond({}, 401);
  await assert.rejects(api.checkInAttendee('token', 'e1', 't1'), (e) => e.status === 401 && /Session expired/.test(e.message));
});
test('manual check-in uses event-scoped endpoint and accepts committed empty success', async () => {
  respond(undefined, 204);
  await api.checkInAttendee('token', 'e1', 't1');
  assert.equal(last.url, 'https://api.example.com/api/mobile/events/e1/tickets/check-in');
  assert.deepEqual(JSON.parse(last.options.body), { ticketId: 't1' });
});
test('attendance rejects missing permission and impossible counters', async () => {
  for (const response of [
    { checkedIn: 1, total: 2 },
    { checkedIn: 3, total: 2, canUndoCheckIn: true },
    { checkedIn: -1, total: 2, canUndoCheckIn: true }
  ]) {
    respond(response);
    await assert.rejects(api.getAttendance('token', 'e1'), /Invalid attendance/);
  }
  respond({ checkedIn: 145, total: 200, canUndoCheckIn: false });
  assert.equal((await api.getAttendance('token', 'e1')).canUndoCheckIn, false);
});
test('malformed attendee records and cursors are rejected', async () => {
  respond({ attendees: [{ ticketId: 't1' }] });
  await assert.rejects(api.getAttendees('token', 'e1'), /Invalid attendee/);
  respond({ attendees: [], nextCursor: 1 });
  await assert.rejects(api.getAttendees('token', 'e1'), /Invalid attendee/);
});
test('QR validation preserves canonical ticket ID for undo', async () => {
  respond({ valid: true, ticketId: 42 });
  assert.equal((await api.validateTicket('token', 'e1', 'qr')).ticketId, '42');
  assert.deepEqual(JSON.parse(last.options.body), { qrPayload: 'qr' });
});
test('network failures and timeout aborts are recognized', async () => {
  globalThis.fetch = async () => { throw new TypeError('Network unavailable'); };
  await assert.rejects(api.getAttendance('token', 'e1'), api.isNetworkError);
  assert.equal(api.isNetworkError({ name: 'AbortError' }), true);
});
