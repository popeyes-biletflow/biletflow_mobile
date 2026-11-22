// FS-22: classify scanned QR data before any request that could change ticket state.
// Admission tickets: ticket_id:event_id:user_id:expires_at:hmac_sha256_hex (signed by FastAPI).
// Campaign QR codes (SRS 4.14) are HTTPS links such as https://api/c/<slug> or /events/<id>?promo=CODE
// and must never be sent to the admission endpoint.

const SIGNATURE = /^[0-9a-f]{64}$/i;

export function isCampaignQr(text) {
  return /^https?:\/\//i.test(text) || /(^|\/)c\/[A-Za-z0-9_-]+\/?$/.test(text) || /[?&]promo=/i.test(text);
}

/**
 * @returns {{ ok: true, ticketId: string, payload: string } | { ok: false, code: string, ticketId?: string }}
 */
export function classifyQr(data, eventId) {
  const text = typeof data === "string" ? data.trim() : "";
  if (!text) return { ok: false, code: "UNREADABLE" };
  if (isCampaignQr(text)) return { ok: false, code: "CAMPAIGN_QR" };
  const parts = text.split(":");
  if (parts.length !== 5 || parts.some((part) => !part) || !/^\d+$/.test(parts[3]) || !SIGNATURE.test(parts[4])) {
    return { ok: false, code: "INVALID_FORMAT" };
  }
  if (parts[1] !== String(eventId)) return { ok: false, code: "WRONG_EVENT", ticketId: parts[0] };
  return { ok: true, ticketId: parts[0], payload: text };
}

// Maps the FastAPI rejection (HTTP status + `detail`) of
// POST /api/mobile/events/{id}/tickets/validate to a specific result code.
export function codeFromVerifyError(status, detail) {
  const text = typeof detail === "string" ? detail.toLowerCase() : "";
  if (status === 409 || text.includes("already")) return "ALREADY_USED";
  if (text.includes("different event")) return "WRONG_EVENT";
  if (text.includes("expired")) return "EXPIRED";
  if (text.includes("cancelled or refunded")) return "CANCELLED_OR_REFUNDED";
  if (text.includes("refund")) return "REFUNDED";
  if (text.includes("cancel")) return "CANCELLED";
  if (status === 404 || text.includes("not found")) return "NOT_FOUND";
  if (text.includes("signature") || text.includes("tamper") || text.includes("format") || text.includes("timestamp")) {
    return "INVALID_SIGNATURE";
  }
  return "INVALID";
}

export const RESULT_TONE = Object.freeze({
  CHECKED_IN: "success",
  ALREADY_USED: "warning",
  OFFLINE: "warning",
  REVERSED: "info"
});

export function toneFor(code) {
  return RESULT_TONE[code] || "error";
}
