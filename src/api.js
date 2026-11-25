// BiletFlow staff API client (FS-21, FS-22, FS-23).
// Pure JS (no React Native imports) so it runs under `node --test`.
//
// Endpoints (biletflow_web FastAPI):
//   POST /api/auth/login | /api/auth/refresh | /api/auth/logout, GET /api/users/me   (FS-01)
//   GET  /api/mobile/events                                   assigned/owned events (FS-04)
//   POST /api/mobile/events/{id}/tickets/validate             signed QR -> atomic check-in
//   GET  /api/mobile/events/{id}/attendance | /attendees      live counts, roster search
//   POST /api/mobile/events/{id}/tickets/check-in             manual check-in
//   POST /api/tickets/undo-checkin                            authorized undo
//   GET  /api/events                                          public list (cover images only)
// Plus every endpoint the web app uses (events, checkout, orders, tickets, support, organizer); see below.
import { classifyQr, codeFromVerifyError } from "./qr.js";
import { normalizeEvent } from "./models.js";

export const STAFF_ROLES = Object.freeze(["event_admin", "organizer", "platform_admin", "admin"]);

export class ApiError extends Error {
  constructor(message, { code = "HTTP", status = 0, detail = null, body = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.detail = detail; // human-readable text
    this.body = body;     // raw FastAPI `detail` (string, list or object such as a checklist)
  }
}

export function normalizeRole(role) {
  return typeof role === "string" ? role.trim().toLowerCase().replace(/[ -]+/g, "_") : "";
}

export function isStaffRole(role) {
  return STAFF_ROLES.includes(normalizeRole(role));
}

export function isNetworkError(error) {
  return error?.code === "NETWORK" || error instanceof TypeError || error?.name === "AbortError";
}

function detailText(body, status) {
  const detail = body?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((item) => (item && typeof item === "object" ? item.msg : String(item))).filter(Boolean).join("; ");
  if (detail && typeof detail === "object") {
    if (typeof detail.message === "string") return detail.message;
    const failed = Object.entries(detail)
      .filter(([, v]) => v && typeof v === "object" && v.passed === false)
      .map(([k, v]) => `${k}${v.detail ? `: ${v.detail}` : ""}`);
    if (failed.length) return failed.join("; ");
    return JSON.stringify(detail);
  }
  if (typeof body?.message === "string") return body.message;
  return `Request failed (${status}).`;
}

function httpError(result) {
  const detail = detailText(result.body, result.status);
  return new ApiError(detail, {
    code: result.status === 403 ? "FORBIDDEN" : result.status === 404 ? "NOT_FOUND" : "HTTP",
    status: result.status,
    detail,
    body: result.body?.detail ?? null
  });
}

const enc = encodeURIComponent;
const query = (params) => {
  const q = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${enc(k)}=${enc(v)}`).join("&");
  return q ? `?${q}` : "";
};

function nowMs() {
  return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
}

/**
 * @param {{
 *   baseUrl: string | (() => string),
 *   store: { load(): Promise<object|null>, save(session: object): Promise<void>, clear(): Promise<void> },
 *   onSessionExpired?: () => void,
 *   fetchImpl?: typeof fetch,
 *   timeoutMs?: number
 * }} options
 */
export function createClient({ baseUrl, store, onSessionExpired, fetchImpl, timeoutMs = 15000 }) {
  let session = null; // { accessToken, refreshToken, userId, email }
  let refreshing = null;
  const doFetch = fetchImpl || ((...args) => globalThis.fetch(...args));
  const origin = () => (typeof baseUrl === "function" ? baseUrl() : baseUrl);

  async function raw(path, { method = "GET", body, token } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    let text = "";
    try {
      response = await doFetch(`${origin()}${path}`, {
        method,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      });
      text = await response.text();
    } catch (error) {
      throw new ApiError(error?.name === "AbortError" ? "The request timed out." : "No connection to the server.", {
        code: "NETWORK"
      });
    } finally {
      clearTimeout(timer);
    }
    let parsed = {};
    try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = {}; }
    return { status: response.status, ok: response.ok, body: parsed };
  }

  async function expire() {
    session = null;
    try { await store.clear(); } catch { /* storage failure must not block sign-out */ }
    onSessionExpired?.();
  }

  async function refresh() {
    if (!session?.refreshToken) throw new ApiError("Session expired.", { code: "SESSION_EXPIRED", status: 401 });
    if (!refreshing) {
      refreshing = (async () => {
        // Refresh tokens rotate: another browser tab may already have stored a newer one (web AuthContext does the same).
        const stored = await store.load().catch(() => null);
        const latest = stored?.refreshToken && stored.userId === session.userId ? stored.refreshToken : session.refreshToken;
        const result = await raw("/api/auth/refresh", { method: "POST", body: { refresh_token: latest } });
        if (!result.ok || typeof result.body?.access_token !== "string") {
          throw new ApiError("Session expired.", { code: "SESSION_EXPIRED", status: 401 });
        }
        session = {
          accessToken: result.body.access_token,
          refreshToken: result.body.refresh_token || latest,
          userId: result.body.user_id || session.userId,
          email: result.body.email || session.email
        };
        await store.save(session);
      })().finally(() => { refreshing = null; });
    }
    return refreshing;
  }

  // Authenticated call. A 401 is rejected by FastAPI's auth dependency before any
  // handler runs, so one retry after refreshing the token cannot double-apply a write.
  async function call(path, options = {}) {
    if (!session) throw new ApiError("Session expired.", { code: "SESSION_EXPIRED", status: 401 });
    let result = await raw(path, { ...options, token: session.accessToken });
    if (result.status === 401) {
      try {
        await refresh();
      } catch (error) {
        if (error.code === "NETWORK") throw error;
        await expire();
        throw new ApiError("Session expired.", { code: "SESSION_EXPIRED", status: 401 });
      }
      result = await raw(path, { ...options, token: session.accessToken });
      if (result.status === 401) {
        await expire();
        throw new ApiError("Session expired.", { code: "SESSION_EXPIRED", status: 401 });
      }
    }
    if (!result.ok) throw httpError(result);
    return result.body;
  }

  // No session needed (public endpoints, sign-up, password reset).
  async function publicCall(path, options = {}) {
    const result = await raw(path, options);
    if (!result.ok) throw httpError(result);
    return result.body;
  }

  // Sends the token when signed in; an expired/unknown session falls back to a public request.
  async function optionalCall(path, options = {}) {
    if (!session) return publicCall(path, options);
    try {
      return await call(path, options);
    } catch (error) {
      if (error.code === "SESSION_EXPIRED") return publicCall(path, options);
      throw error;
    }
  }

  async function getProfile() {
    const profile = await call("/api/users/me");
    if (!profile || typeof profile.id !== "string") throw new ApiError("Invalid user profile response.");
    return { ...profile, role: normalizeRole(profile.role) };
  }

  function requireActive(profile) {
    if (profile.is_suspended) throw new ApiError("Account suspended.", { code: "SUSPENDED", status: 403 });
  }

  return {
    get session() { return session; },

    /** Any role can sign in (attendee, organizer, staff, admin). Failed sign-ins never create a stored session. */
    async signIn(email, password) {
      const result = await raw("/api/auth/login", { method: "POST", body: { email, password } });
      if (!result.ok || typeof result.body?.access_token !== "string") {
        const detail = detailText(result.body, result.status);
        if (result.status === 401) throw new ApiError(detail, { code: "BAD_CREDENTIALS", status: 401 });
        if (result.status === 403 && detail === "EMAIL_NOT_CONFIRMED") throw new ApiError(detail, { code: "NOT_CONFIRMED", status: 403 });
        if (result.status === 403) throw new ApiError(detail, { code: "SUSPENDED", status: 403 });
        if (result.status === 429) throw new ApiError(detail, { code: "TOO_MANY", status: 429 });
        throw new ApiError(detail, { code: "SERVICE", status: result.status });
      }
      session = {
        accessToken: result.body.access_token,
        refreshToken: result.body.refresh_token || "",
        userId: result.body.user_id || "",
        email: result.body.email || email
      };
      try {
        const profile = await getProfile();
        requireActive(profile);
        await store.save(session);
        return profile;
      } catch (error) {
        session = null;
        throw error;
      }
    },

    /** Restores a stored session; returns null when there is none. Network errors propagate. */
    async restore() {
      const stored = await store.load();
      if (!stored?.accessToken) return null;
      session = stored;
      const profile = await getProfile();
      try {
        requireActive(profile);
      } catch (error) {
        await expire();
        throw error;
      }
      return profile;
    },

    async signOut() {
      const token = session?.accessToken;
      session = null;
      await store.clear();
      if (token) {
        // Revoke the refresh token server-side; never block sign-out on it.
        raw("/api/auth/logout", { method: "POST", token }).catch(() => {});
      }
    },

    getProfile,

    async getAssignedEvents() {
      const result = await call("/api/mobile/events");
      if (!Array.isArray(result?.events)) throw new ApiError("The assigned-events response is invalid.");
      const events = result.events.map((event) => {
        if (!event || event.id == null || typeof (event.name ?? event.title) !== "string") {
          throw new ApiError("An assigned event is missing its ID or name.");
        }
        return {
          id: String(event.id),
          name: event.name ?? event.title,
          venue: event.venue ?? event.venue_name ?? "",
          startsAt: event.startsAt ?? event.starts_at ?? "",
          imageUrl: null,
          category: "",
          timezone: "Asia/Almaty",
          venueAddress: "",
          organizerId: null
        };
      });
      // Cover images and categories come from the public catalog (same look as the web cards).
      // Best effort: unlisted/private events simply keep the placeholder.
      try {
        const extra = await raw("/api/events");
        if (extra.ok && Array.isArray(extra.body)) {
          const byId = new Map(extra.body.map((row) => [String(row.id), row]));
          for (const event of events) {
            const row = byId.get(event.id);
            if (!row) continue;
            event.imageUrl = typeof row.image_url === "string" && row.image_url ? row.image_url : null;
            event.category = row.category || "";
            event.timezone = row.timezone || event.timezone;
            event.venueAddress = row.venue_address || "";
            event.organizerId = row.organizer_id == null ? null : String(row.organizer_id);
          }
        }
      } catch { /* catalog is decorative */ }
      return events.sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)));
    },

    /**
     * Verifies a scanned QR online. Campaign, malformed and other-event codes are rejected
     * locally and never reach the endpoint that changes attendance.
     * @returns {Promise<{ code: string, ticketId: string|null, message: string, latencyMs: number|null, local: boolean }>}
     */
    async verifyTicket(eventId, data) {
      const pre = classifyQr(data, eventId);
      if (!pre.ok) return { code: pre.code, ticketId: pre.ticketId || null, message: "", latencyMs: null, local: true };
      const started = nowMs();
      try {
        const result = await call(`/api/mobile/events/${encodeURIComponent(eventId)}/tickets/validate`, {
          method: "POST",
          body: { qrPayload: pre.payload }
        });
        const latencyMs = Math.round(nowMs() - started);
        if (result?.valid !== true) {
          return { code: codeFromVerifyError(200, result?.message), ticketId: pre.ticketId, message: result?.message || "", latencyMs, local: false };
        }
        return {
          code: "CHECKED_IN",
          ticketId: String(result.ticketId ?? result.ticket_id ?? pre.ticketId),
          message: result.message || "",
          latencyMs,
          local: false
        };
      } catch (error) {
        if ([400, 404, 409, 422].includes(error.status)) {
          return {
            code: codeFromVerifyError(error.status, error.detail),
            ticketId: pre.ticketId,
            message: error.detail || "",
            latencyMs: Math.round(nowMs() - started),
            local: false
          };
        }
        throw error;
      }
    },

    async getAttendance(eventId) {
      const result = await call(`/api/mobile/events/${encodeURIComponent(eventId)}/attendance`);
      if (!result || !Number.isInteger(result.checkedIn) || !Number.isInteger(result.total) ||
          result.checkedIn < 0 || result.total < 0) {
        throw new ApiError("Invalid attendance response.");
      }
      return {
        checkedIn: result.checkedIn,
        total: Math.max(result.total, result.checkedIn),
        canUndoCheckIn: result.canUndoCheckIn === true
      };
    },

    async getAttendees(eventId, search = "", cursor = "", limit = 50) {
      const query = `search=${encodeURIComponent(search)}&cursor=${encodeURIComponent(cursor || "")}&limit=${limit}`;
      const result = await call(`/api/mobile/events/${encodeURIComponent(eventId)}/attendees?${query}`);
      if (!result || !Array.isArray(result.attendees)) throw new ApiError("Invalid attendee response.");
      const attendees = result.attendees.map((item) => {
        if (!item || item.ticketId == null || typeof item.checkedIn !== "boolean") {
          throw new ApiError("Invalid attendee response.");
        }
        return {
          ticketId: String(item.ticketId),
          name: typeof item.name === "string" && item.name ? item.name : "Attendee",
          email: typeof item.email === "string" ? item.email : "",
          checkedIn: item.checkedIn
        };
      });
      return { attendees, nextCursor: typeof result.nextCursor === "string" && result.nextCursor ? result.nextCursor : null };
    },

    async checkIn(eventId, ticketId) {
      await call(`/api/mobile/events/${encodeURIComponent(eventId)}/tickets/check-in`, {
        method: "POST",
        body: { ticketId }
      });
    },

    async undoCheckIn(eventId, ticketId) {
      await call("/api/tickets/undo-checkin", { method: "POST", body: { eventId, ticketId } });
    },
    // ---------------- account (FS-01 / FS-16) ----------------
    async signUp(email, password, fullName) {
      return publicCall("/api/auth/signup", { method: "POST", body: { email, password, full_name: fullName } });
    },
    async resendVerification(email) {
      return publicCall("/api/auth/resend-verification", { method: "POST", body: { email } });
    },
    async requestPasswordReset(email) {
      return publicCall("/api/auth/reset-password", { method: "POST", body: { email } });
    },
    async updateProfile(fields) {
      const profile = await call("/api/users/me", { method: "PATCH", body: fields });
      return { ...profile, role: normalizeRole(profile.role) };
    },
    /** Valid access token for requests made outside this client (PDF download). */
    async freshToken() {
      await getProfile(); // refreshes on 401
      return session?.accessToken || null;
    },
    url(path) { return `${origin()}${path}`; },

    // ---------------- discovery (PB-8 / FS-11) ----------------
    async getEvents() {
      const rows = await publicCall("/api/events");
      return (Array.isArray(rows) ? rows : []).map(normalizeEvent).filter((e) => e.status === "published");
    },
    /** With the organizer's token the owner can also open drafts (preview). */
    async getEvent(eventId) {
      return normalizeEvent(await optionalCall(`/api/events/${enc(eventId)}`));
    },

    // ---------------- checkout & orders (FS-17 / FS-18) ----------------
    holdTickets(ticketTypeId, quantity, code) {
      return call("/api/checkout/apply-promo", { method: "POST", body: { ticket_type_id: ticketTypeId, quantity, code: code || null } });
    },
    releaseHold(holdId) {
      return call(`/api/checkout/holds/${enc(holdId)}/release`, { method: "POST" });
    },
    confirmOrder(holdId, outcome, attendees) {
      return call("/api/orders", { method: "POST", body: { hold_id: holdId, payment_outcome: outcome, attendees } });
    },
    getOrders() { return call("/api/me/orders"); },
    getOrder(orderId) { return call(`/api/me/orders/${enc(orderId)}`); },
    getMyTickets() { return call("/api/me/tickets"); },
    getMyTicket(ticketId) { return call(`/api/me/tickets/${enc(ticketId)}`); },
    ticketPdfPath(ticketId, lang) { return `/api/me/tickets/${enc(ticketId)}/pdf?lang=${enc(lang || "ru")}`; },
    /** Cancellation request = support case with category "refund" (same as the web). */
    requestCancel(ticketId, subject, message) {
      return call("/api/support/cases", { method: "POST", body: { category: "refund", subject, message, ticket_id: ticketId } });
    },

    // ---------------- support & notifications (FS-05 / FS-19 / FS-20) ----------------
    async listCases(filters = {}) {
      const result = await call(`/api/support/cases${query({ ...filters, page_size: 100 })}`);
      return Array.isArray(result?.cases) ? result.cases : [];
    },
    getCase(caseId) { return call(`/api/support/cases/${enc(caseId)}`); },
    createCase(body) { return call("/api/support/cases", { method: "POST", body }); },
    replyCase(caseId, text) { return call(`/api/support/cases/${enc(caseId)}/messages`, { method: "POST", body: { body: text } }); },
    setCaseStatus(caseId, status, assignToMe = false) {
      return call(`/api/support/cases/${enc(caseId)}/status`, { method: "PATCH", body: { status, assign_to_me: assignToMe } });
    },
    escalateCase(caseId, note) { return call(`/api/support/cases/${enc(caseId)}/escalate`, { method: "POST", body: { note } }); },
    async getNotifications() {
      const list = await call("/api/support/notifications");
      return Array.isArray(list) ? list : [];
    },
    markNotificationRead(id) { return call(`/api/support/notifications/${enc(id)}/read`, { method: "PATCH" }); },

    // ---------------- organizer (FS-02 / FS-03 / FS-10 / FS-12 / FS-13 / FS-14) ----------------
    organizerDashboard() { return call("/api/organizer/dashboard"); },
    organizerAnalytics(eventId, filters = {}) { return call(`/api/organizer/events/${enc(eventId)}/analytics${query(filters)}`); },
    organizerEvents() { return call("/api/organizer/events"); },
    createEvent(body) { return call("/api/organizer/events", { method: "POST", body }); },
    updateEvent(eventId, body) { return call(`/api/organizer/events/${enc(eventId)}`, { method: "PATCH", body }); },
    eventAction(eventId, action) {
      if (!["publish", "unpublish", "cancel"].includes(action)) throw new Error(`Unknown action ${action}`);
      return call(`/api/organizer/events/${enc(eventId)}/${action}`, { method: "POST" });
    },
    ticketTypes(eventId) { return call(`/api/organizer/events/${enc(eventId)}/ticket-types`); },
    createTicketType(eventId, body) { return call(`/api/organizer/events/${enc(eventId)}/ticket-types`, { method: "POST", body }); },
    updateTicketType(ticketTypeId, body) { return call(`/api/organizer/ticket-types/${enc(ticketTypeId)}`, { method: "PATCH", body }); },
    activatePaidSales(eventId, termsAccepted) {
      return call(`/api/organizer/events/${enc(eventId)}/activate-paid-sales`, { method: "POST", body: { paid_event_terms_accepted: termsAccepted } });
    },
    savePayout(payoutInfo) { return call("/api/users/me", { method: "PUT", body: { payout_info: payoutInfo } }); },
    listStaff(eventId) { return call(`/api/organizer/events/${enc(eventId)}/staff`); },
    assignStaff(eventId, email) { return call(`/api/organizer/events/${enc(eventId)}/staff`, { method: "POST", body: { email } }); },
    removeStaff(eventId, userId) { return call(`/api/organizer/events/${enc(eventId)}/staff/${enc(userId)}`, { method: "DELETE" }); }

  };
}
