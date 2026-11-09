import { API_MODE, API_CAPABILITIES, getApiBaseUrl } from "./apiConfig";

export { API_CAPABILITIES };

async function request(path, { token, ...options } = {}) {
  const API_BASE_URL = getApiBaseUrl();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  let response;
  let text;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers
      }
    });
    text = await response.text();
  } finally {
    clearTimeout(timer);
  }
  let body;

  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = {};
  }

  if (!response.ok) {
    const error = new Error(response.status === 401 ? "Session expired. Sign out and sign in again." : response.status === 403 ? "You are not authorized for this event or action." : getErrorMessage(body, response.status));
    error.status = response.status;
    throw error;
  }

  return body;
}

function getErrorMessage(body, status) {
  if (typeof body?.detail === "string") return body.detail;
  if (Array.isArray(body?.detail)) {
    return body.detail.map((item) => item.msg).filter(Boolean).join("; ") || `Request failed (${status}).`;
  }
  return typeof body?.message === "string" ? body.message : typeof body?.error === "string" ? body.error : `Request failed (${status}).`;
}

function requireAttendeeOperations() {
  if (!API_CAPABILITIES.attendeeOperations) {
    const error = new Error("This backend does not provide attendee search, manual check-in, undo, or attendance counters yet.");
    error.code = "UNSUPPORTED_OPERATION";
    throw error;
  }
}

export async function getCurrentUser(token) {
  const profile = await request("/api/users/me", { token });
  if (!profile || typeof profile.id !== "string" || typeof profile.email !== "string") {
    throw new Error("Invalid user profile response.");
  }
  return profile;
}

function requireStaffProfile(profile) {
  const role = typeof profile.role === "string" ? profile.role.trim().toLowerCase().replace(/[ -]+/g, "_") : "";
  if (!["event_admin", "organizer", "admin"].includes(role)) {
    const error = new Error("Event staff access is required. Contact your organizer to check your account role.");
    error.status = 403;
    throw error;
  }
}

// Connectivity checks are deliberately separate from attendance synchronization.
export async function getEventConnection(token, eventId) {
  requireStaffProfile(await getCurrentUser(token));
  const event = await request(`/api/events/${encodeURIComponent(eventId)}`, { token });
  if (!event || String(event.id) !== String(eventId)) throw new Error("Invalid event response.");
}

export async function signIn(email, password) {
  const result = await request(API_MODE === "web" ? "/api/auth/login" : "/api/mobile/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });

  const accessToken = API_MODE === "web" ? result?.access_token : result?.accessToken;
  if (typeof accessToken !== "string" || !accessToken) {
    throw new Error("The sign-in response did not include an access token.");
  }

  return accessToken;
}

export async function getAvailableEvents(token) {
  if (API_MODE === "web") requireStaffProfile(await getCurrentUser(token));
  const result = await request(API_MODE === "web" ? "/api/events" : "/api/mobile/events", { token });
  const events = API_MODE === "web" ? result : result?.events;

  if (!Array.isArray(events)) {
    throw new Error("The assigned-events response is invalid.");
  }

  return events.map((event) => {
    if (!event || (typeof event.id !== "string" && typeof event.id !== "number") ||
        typeof (event.name ?? event.title) !== "string") {
      throw new Error("An assigned event is missing its required ID or name.");
    }

    return {
      id: String(event.id),
      name: event.name ?? event.title,
      venue: event.venue_name ?? event.venue ?? event.location ?? "",
      startsAt: event.startsAt ?? event.starts_at ?? event.start_time ?? event.date ?? event.event_date ?? ""
    };
  });
}

export async function validateTicket(token, eventId, qrPayload) {
  // The legacy web endpoint does not accept an event ID. Reject a QR for a
  // different event before sending the request that changes ticket state.
  if (API_MODE === "web") {
    const parts = typeof qrPayload === "string" ? qrPayload.split(":") : [];
    if (parts.length !== 5 || parts.some((part) => !part)) {
      return { valid: false, ticketId: null, message: "Invalid BiletFlow QR payload format." };
    }
    if (parts[1] !== String(eventId)) {
      return { valid: false, ticketId: null, message: "This ticket belongs to a different event." };
    }
    // This checks the session, not staff event authorization. The backend must
    // enforce event authorization and atomic check-in itself.
    requireStaffProfile(await getCurrentUser(token));
  }
  let result;
  try {
    result = await request(
      API_MODE === "web" ? "/api/tickets/verify" : `/api/mobile/events/${encodeURIComponent(eventId)}/tickets/validate`,
      { token, method: "POST", body: JSON.stringify(API_MODE === "web" ? { qr_payload: qrPayload } : { qrPayload }) }
    );
  } catch (error) {
    if (API_MODE === "web" && [400, 404, 409].includes(error.status)) {
      return { valid: false, ticketId: null, message: error.message };
    }
    throw error;
  }

  if (typeof result?.valid !== "boolean") {
    throw new Error("The ticket-validation response did not include a valid boolean result.");
  }

  return {
    valid: result.valid,
    ticketId: (result.ticket_id ?? result.ticketId) == null ? null : String(result.ticket_id ?? result.ticketId),
    message: typeof result.message === "string" ? result.message : ""
  };
}

export function isNetworkError(error) {
  return error instanceof TypeError || error?.name === "TypeError" || error?.name === "AbortError";
}

export async function getAttendance(token, eventId) {
  requireAttendeeOperations();
  const result = await request(`/api/mobile/events/${encodeURIComponent(eventId)}/attendance`, { token });
  if (!result || !Number.isInteger(result.checkedIn) || !Number.isInteger(result.total) || result.checkedIn < 0 ||
      result.total < result.checkedIn || typeof result.canUndoCheckIn !== "boolean") {
    throw new Error("Invalid attendance response.");
  }
  return result;
}

export async function getAttendees(token, eventId, search = "", cursor = "") {
  requireAttendeeOperations();
  const result = await request(`/api/mobile/events/${encodeURIComponent(eventId)}/attendees?search=${encodeURIComponent(search)}&cursor=${encodeURIComponent(cursor)}&limit=50`, { token });
  if (!result || !Array.isArray(result.attendees) || result.attendees.some((item) => !item ||
      !["string", "number"].includes(typeof item.ticketId) || typeof item.name !== "string" ||
      typeof item.email !== "string" || typeof item.checkedIn !== "boolean") ||
      (result.nextCursor != null && typeof result.nextCursor !== "string")) {
    throw new Error("Invalid attendee response.");
  }
  return { attendees: result.attendees.map((item) => ({ ...item, ticketId: String(item.ticketId) })), nextCursor: result.nextCursor || null };
}

export async function checkInAttendee(token, eventId, ticketId) {
  requireAttendeeOperations();
  await request(`/api/mobile/events/${encodeURIComponent(eventId)}/tickets/check-in`, {
    token, method: "POST", body: JSON.stringify({ ticketId })
  });
}

export async function undoCheckIn(token, eventId, ticketId) {
  requireAttendeeOperations();
  await request("/api/tickets/undo-checkin", {
    token, method: "POST", body: JSON.stringify({ eventId, ticketId })
  });
}
