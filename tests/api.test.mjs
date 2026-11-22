import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient, isStaffRole } from "../src/api.js";

const BASE = "https://api.example.com";
const SIG = "b".repeat(64);
const QR = `t1:e1:u1:9999999999:${SIG}`;

function memoryStore(initial = null) {
  let value = initial;
  return {
    saved: () => value,
    async load() { return value; },
    async save(next) { value = next; },
    async clear() { value = null; }
  };
}

// Route table: "METHOD /path" -> handler(request) => { status, body } | Error to throw
function fakeServer(routes) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const path = url.replace(BASE, "");
    const key = `${options.method || "GET"} ${path.split("?")[0]}`;
    const request = { path, method: options.method || "GET", headers: options.headers || {}, body: options.body ? JSON.parse(options.body) : undefined };
    calls.push(request);
    const handler = routes[key];
    if (!handler) return { ok: false, status: 404, text: async () => JSON.stringify({ detail: "Not Found" }) };
    const result = await handler(request, calls);
    if (result instanceof Error) throw result;
    const { status = 200, body } = result;
    return { ok: status < 400, status, text: async () => (body === undefined ? "" : JSON.stringify(body)) };
  };
  return { calls, fetchImpl };
}

const LOGIN_OK = { status: 200, body: { access_token: "a1", refresh_token: "r1", user_id: "staff-1", email: "s@x.kz" } };
const profile = (role) => ({ status: 200, body: { id: "staff-1", email: "s@x.kz", full_name: "Staff", role, is_suspended: false } });

function signedInClient(routes, store = memoryStore({ accessToken: "a1", refreshToken: "r1", userId: "staff-1", email: "s@x.kz" })) {
  const server = fakeServer({ "GET /api/users/me": () => profile("event_admin"), ...routes });
  let expired = 0;
  const client = createClient({ baseUrl: BASE, store, fetchImpl: server.fetchImpl, onSessionExpired: () => { expired += 1; } });
  return { client, server, store, expired: () => expired };
}

test("staff roles include organizers and platform admins, not attendees", () => {
  for (const role of ["event_admin", "Organizer", "platform-admin", "admin"]) assert.ok(isStaffRole(role), role);
  assert.equal(isStaffRole("attendee"), false);
  assert.equal(isStaffRole(undefined), false);
});

test("FS-21: organizer can sign in; tokens are stored only after the role check", async () => {
  const store = memoryStore();
  const server = fakeServer({ "POST /api/auth/login": () => LOGIN_OK, "GET /api/users/me": () => profile("organizer") });
  const client = createClient({ baseUrl: BASE, store, fetchImpl: server.fetchImpl });
  const user = await client.signIn("s@x.kz", "pw");
  assert.equal(user.role, "organizer");
  assert.deepEqual(store.saved(), { accessToken: "a1", refreshToken: "r1", userId: "staff-1", email: "s@x.kz" });
  assert.equal(server.calls[1].headers.Authorization, "Bearer a1");
});

test("attendees can sign in (full app); the scanner stays staff-only on the server", async () => {
  const store = memoryStore();
  const attendee = fakeServer({
    "POST /api/auth/login": () => LOGIN_OK,
    "GET /api/users/me": () => profile("attendee"),
    "GET /api/mobile/events": () => ({ status: 403, body: { detail: "Event staff access is required." } })
  });
  const c1 = createClient({ baseUrl: BASE, store, fetchImpl: attendee.fetchImpl });
  assert.equal((await c1.signIn("a@x.kz", "pw")).role, "attendee");
  assert.equal(store.saved().accessToken, "a1");
  await assert.rejects(c1.getAssignedEvents(), { code: "FORBIDDEN" });
});

test("FS-21: wrong credentials, unconfirmed email and suspended accounts never create a stored session", async () => {
  const store = memoryStore();
  const suspended = fakeServer({ "POST /api/auth/login": () => LOGIN_OK, "GET /api/users/me": () => ({ body: { id: "x", email: "s@x.kz", role: "organizer", is_suspended: true } }) });
  const c1 = createClient({ baseUrl: BASE, store, fetchImpl: suspended.fetchImpl });
  await assert.rejects(c1.signIn("a@x.kz", "pw"), { code: "SUSPENDED" });
  assert.equal(store.saved(), null);
  assert.equal(c1.session, null);

  const wrong = fakeServer({ "POST /api/auth/login": () => ({ status: 401, body: { detail: "Invalid email or password." } }) });
  const c2 = createClient({ baseUrl: BASE, store, fetchImpl: wrong.fetchImpl });
  await assert.rejects(c2.signIn("a@x.kz", "bad"), { code: "BAD_CREDENTIALS" });
  assert.equal(store.saved(), null);

  const unconfirmed = fakeServer({ "POST /api/auth/login": () => ({ status: 403, body: { detail: "EMAIL_NOT_CONFIRMED" } }) });
  await assert.rejects(createClient({ baseUrl: BASE, store, fetchImpl: unconfirmed.fetchImpl }).signIn("a", "b"), { code: "NOT_CONFIRMED" });
});

test("FS-21: network failure during sign-in is reported as NETWORK", async () => {
  const server = fakeServer({ "POST /api/auth/login": () => new TypeError("Network request failed") });
  const client = createClient({ baseUrl: BASE, store: memoryStore(), fetchImpl: server.fetchImpl });
  await assert.rejects(client.signIn("a", "b"), { code: "NETWORK" });
});

test("FS-21: expired access token is refreshed once and the request retried", async () => {
  const { client, server, store } = signedInClient({
    "GET /api/mobile/events": (req) => req.headers.Authorization === "Bearer a2"
      ? { body: { events: [{ id: "e1", name: "Concert", venue: "Hall", startsAt: "2026-12-01T10:00:00Z" }] } }
      : { status: 401, body: { detail: "Invalid or expired token." } },
    "POST /api/auth/refresh": (req) => {
      assert.deepEqual(req.body, { refresh_token: "r1" });
      return { body: { access_token: "a2", refresh_token: "r2", user_id: "staff-1", email: "s@x.kz" } };
    },
    "GET /api/events": () => ({ body: [] })
  });
  await client.restore();
  const events = await client.getAssignedEvents();
  assert.equal(events[0].id, "e1");
  assert.equal(store.saved().accessToken, "a2");
  assert.equal(server.calls.filter((c) => c.path === "/api/auth/refresh").length, 1);
});

test("FS-21: failed refresh clears the stored session and signals expiry", async () => {
  const { client, store, expired } = signedInClient({
    "GET /api/mobile/events": () => ({ status: 401, body: {} }),
    "POST /api/auth/refresh": () => ({ status: 401, body: { detail: "Session expired." } })
  });
  await client.restore();
  await assert.rejects(client.getAssignedEvents(), { code: "SESSION_EXPIRED" });
  assert.equal(store.saved(), null);
  assert.equal(expired(), 1);
});

test("FS-21: assigned events come from /api/mobile/events; catalog only adds images", async () => {
  const { client } = signedInClient({
    "GET /api/mobile/events": () => ({ body: { events: [
      { id: "eB", name: "B", venue: "", startsAt: "2026-12-05T10:00:00Z" },
      { id: "eA", name: "A", venue: "Hall", startsAt: "2026-12-01T10:00:00Z" }
    ] } }),
    "GET /api/events": () => ({ body: [
      { id: "eA", image_url: "https://img/a.jpg", category: "Concert", timezone: "Asia/Almaty", organizer_id: "staff-1" },
      { id: "eZ", title: "Unassigned public event" }
    ] })
  });
  await client.restore();
  const events = await client.getAssignedEvents();
  assert.deepEqual(events.map((e) => e.id), ["eA", "eB"]); // sorted by start; unassigned eZ never appears
  assert.equal(events[0].imageUrl, "https://img/a.jpg");
  assert.equal(events[0].organizerId, "staff-1");
  assert.equal(events[1].imageUrl, null);
});

test("FS-21: a revoked assignment surfaces as FORBIDDEN", async () => {
  const { client } = signedInClient({
    "GET /api/mobile/events/e1/attendance": () => ({ status: 403, body: { detail: "You are not assigned to manage check-ins for this event." } })
  });
  await client.restore();
  await assert.rejects(client.getAttendance("e1"), { code: "FORBIDDEN", status: 403 });
});

test("FS-22: valid scan posts the payload to the event-scoped endpoint and is timed", async () => {
  const { client, server } = signedInClient({
    "POST /api/mobile/events/e1/tickets/validate": () => ({ body: { valid: true, ticketId: "t1", message: "Check-in successful" } })
  });
  await client.restore();
  const result = await client.verifyTicket("e1", QR);
  assert.equal(result.code, "CHECKED_IN");
  assert.equal(result.ticketId, "t1");
  assert.equal(result.local, false);
  assert.ok(Number.isInteger(result.latencyMs) && result.latencyMs >= 0);
  const call = server.calls.find((c) => c.path.endsWith("/validate"));
  assert.deepEqual(call.body, { qrPayload: QR });
  assert.equal(call.headers.Authorization, "Bearer a1");
});

test("FS-22: already-used, refunded/cancelled and expired outcomes are specific", async () => {
  const responses = {
    ALREADY_USED: { status: 409, body: { detail: "Ticket has already been used." } },
    CANCELLED_OR_REFUNDED: { status: 400, body: { detail: "Ticket is cancelled or refunded." } },
    EXPIRED: { status: 400, body: { detail: "QR code has expired." } },
    NOT_FOUND: { status: 404, body: { detail: "Ticket not found." } }
  };
  for (const [code, response] of Object.entries(responses)) {
    const { client } = signedInClient({ "POST /api/mobile/events/e1/tickets/validate": () => response });
    await client.restore();
    const result = await client.verifyTicket("e1", QR);
    assert.equal(result.code, code);
  }
});

test("FS-22: campaign and other-event QR codes never reach the admission endpoint", async () => {
  const { client, server } = signedInClient({
    "POST /api/mobile/events/e1/tickets/validate": () => { throw new Error("must not be called"); }
  });
  await client.restore();
  assert.equal((await client.verifyTicket("e1", "https://api.example.com/c/sale")).code, "CAMPAIGN_QR");
  assert.equal((await client.verifyTicket("e1", `t1:e2:u1:9999999999:${SIG}`)).code, "WRONG_EVENT");
  assert.equal(server.calls.some((c) => c.path.endsWith("/validate")), false);
});

test("FS-22: network interruption throws NETWORK (the UI shows no admission)", async () => {
  const { client } = signedInClient({ "POST /api/mobile/events/e1/tickets/validate": () => new TypeError("Network request failed") });
  await client.restore();
  await assert.rejects(client.verifyTicket("e1", QR), { code: "NETWORK" });
});

test("FS-23: roster search encodes query and cursor; actions hit the documented routes", async () => {
  const { client, server } = signedInClient({
    "GET /api/mobile/events/e%2F1/attendees": () => ({ body: { attendees: [{ ticketId: 42, name: "Alex", email: "a@b.kz", checkedIn: false }], nextCursor: "p2" } }),
    "POST /api/mobile/events/e1/tickets/check-in": () => ({ body: { success: true } }),
    "POST /api/tickets/undo-checkin": () => ({ body: { success: true } }),
    "GET /api/mobile/events/e1/attendance": () => ({ body: { checkedIn: 3, total: 10, canUndoCheckIn: true } })
  });
  await client.restore();
  const page = await client.getAttendees("e/1", "a+b@b.kz", "p 1");
  assert.equal(page.attendees[0].ticketId, "42");
  assert.equal(page.nextCursor, "p2");
  assert.ok(server.calls.some((c) => c.path === "/api/mobile/events/e%2F1/attendees?search=a%2Bb%40b.kz&cursor=p%201&limit=50"));
  await client.checkIn("e1", "t1");
  await client.undoCheckIn("e1", "t1");
  assert.deepEqual(server.calls.find((c) => c.path.endsWith("/check-in")).body, { ticketId: "t1" });
  assert.deepEqual(server.calls.find((c) => c.path === "/api/tickets/undo-checkin").body, { eventId: "e1", ticketId: "t1" });
  assert.deepEqual(await client.getAttendance("e1"), { checkedIn: 3, total: 10, canUndoCheckIn: true });
});

test("FS-23: server-denied undo and duplicate check-in keep their status codes", async () => {
  const { client } = signedInClient({
    "POST /api/tickets/undo-checkin": () => ({ status: 403, body: { detail: "You are not authorized for this event or action." } }),
    "POST /api/mobile/events/e1/tickets/check-in": () => ({ status: 409, body: { detail: "Ticket has already been used." } })
  });
  await client.restore();
  await assert.rejects(client.undoCheckIn("e1", "t1"), { code: "FORBIDDEN", status: 403 });
  await assert.rejects(client.checkIn("e1", "t1"), { status: 409 });
});

test("FS-21: sign-out clears the stored session and revokes server-side", async () => {
  const { client, server, store } = signedInClient({ "POST /api/auth/logout": () => ({ body: { message: "ok" } }) });
  await client.restore();
  await client.signOut();
  assert.equal(store.saved(), null);
  assert.equal(client.session, null);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.ok(server.calls.some((c) => c.path === "/api/auth/logout" && c.headers.Authorization === "Bearer a1"));
  await assert.rejects(client.getAttendance("e1"), { code: "SESSION_EXPIRED" });
});
