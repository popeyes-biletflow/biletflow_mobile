// Pure data helpers ported from biletflow_web/frontend/src/services (events.ts, calendar.ts,
// CheckoutModal.tsx, TicketDashboard.tsx) so the mobile app follows the same rules as the web.

/** Accepts old and new `events` column names, like the web normalizeEvent. Hidden tiers are dropped. */
export function normalizeEvent(r) {
  const tiers = r.ticket_types ?? r.ticket_tiers ?? [];
  return {
    id: String(r.id),
    title: r.title ?? r.name ?? "Untitled event",
    description: r.description ?? "",
    category: r.category ?? "Other",
    startsAt: r.starts_at ?? r.start_time ?? r.date ?? r.event_date ?? new Date().toISOString(),
    endsAt: r.ends_at ?? r.end_time ?? null,
    timezone: r.timezone ?? "Asia/Almaty",
    venueName: r.venue_name ?? r.venue ?? r.location ?? "",
    venueAddress: r.venue_address ?? r.address ?? "",
    imageUrl: r.image_url ?? null,
    status: r.status === "draft" || r.status === "cancelled" ? r.status : "published",
    visibility: r.visibility === "unlisted" || r.visibility === "private" ? r.visibility : "public",
    paidSalesActive: r.paid_sales_status === "ACTIVE" && r.paid_sales_active !== false,
    registrationOpensAt: r.registration_opens_at ?? null,
    registrationClosesAt: r.registration_closes_at ?? null,
    organizerId: r.organizer_id == null ? null : String(r.organizer_id),
    ticketTiers: tiers.filter((t) => !t.is_hidden).map((t) => ({
      id: String(t.id),
      name: t.name ?? "Standard",
      description: t.description ?? "",
      priceKZT: Number(t.price ?? t.price_kzt ?? 0),
      remaining: t.available ?? t.quantity ?? t.stock ?? null,
      maxPerOrder: t.max_per_order ?? null,
      saleStartsAt: t.sale_starts_at ?? null,
      saleEndsAt: t.sale_ends_at ?? null
    }))
  };
}

export const categoryKey = (raw) => String(raw || "").trim().toLowerCase();

/** Why a tier cannot be bought right now (null = available). Same order as the web checkout. */
export function whyUnavailable(tier, event, now = Date.now()) {
  if (tier.remaining !== null && tier.remaining <= 0) return "soldOut";
  if (tier.priceKZT > 0 && !event.paidSalesActive) return "paidInactive";
  if (tier.saleStartsAt && now < Date.parse(tier.saleStartsAt)) return "notStarted";
  if (tier.saleEndsAt && now > Date.parse(tier.saleEndsAt)) return "ended";
  return null;
}

export function maxQuantity(tier) {
  let max = 10;
  if (tier?.maxPerOrder) max = Math.min(max, tier.maxPerOrder);
  if (tier?.remaining !== null && tier?.remaining !== undefined) max = Math.max(1, Math.min(max, tier.remaining));
  return max;
}

/** Backend checkout errors are codes like SOLD_OUT / PROMO_EXHAUSTED (string or {code}). */
export function checkoutErrorCode(error) {
  const detail = error?.body;
  if (typeof detail === "string" && /^[A-Z_]+$/.test(detail)) return detail;
  if (detail && typeof detail === "object" && "code" in detail) return String(detail.code);
  if (error?.status === 401 || error?.code === "SESSION_EXPIRED") return "SESSION";
  if (error?.code === "NETWORK") return "NETWORK";
  return "GENERIC";
}

export const TICKET_FILTERS = ["ALL", "ACTIVE", "USED", "CANCELLED", "REFUNDED"];

export function ticketMatches(status, filter) {
  if (filter === "ALL") return true;
  if (filter === "CANCELLED") return status === "CANCELLED" || status === "CANCEL_PENDING";
  return status === filter;
}

export const TICKET_BADGE_TONE = { ACTIVE: "success", USED: "neutral", CANCEL_PENDING: "warning", CANCELLED: "error", REFUNDED: "purple" };
export const INVALID_TICKET = ["REFUNDED", "CANCELLED", "USED"];

export const SUPPORT_CATEGORIES = ["ticket_delivery", "payment", "refund", "seating", "event_information", "check_in", "account", "technical"];
export const ORGANIZER_PLATFORM_CATEGORIES = ["account", "payment", "technical"];
export const SUPPORT_STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_FOR_CUSTOMER", "RESOLVED"];
export const SUPPORT_STATUS_TONE = { OPEN: "blue", IN_PROGRESS: "warning", WAITING_FOR_CUSTOMER: "purple", RESOLVED: "neutral" };

export const PHASES = ["upcoming", "active", "completed", "cancelled"];
export const PHASE_TONE = { upcoming: "blue", active: "success", completed: "neutral", cancelled: "error" };
export const EVENT_STATUS_TONE = { draft: "neutral", published: "success", cancelled: "error" };

export const CHECKLIST_KEYS = [
  "at_least_one_paid_ticket_type",
  "valid_payout_account",
  "identity_verified",
  "activation_fee_paid",
  "paid_event_terms_accepted"
];
export const ACTIVATION_FEE_KZT = 5000;

/** Where a notification leads (web NotificationBell.linkFor), as an app route. */
export function notificationTarget(n) {
  if (n?.data?.case_id) return { screen: "SupportCase", params: { caseId: String(n.data.case_id) } };
  const url = typeof n?.data?.url === "string" ? n.data.url : "";
  let m = url.match(/^\/orders\/([^/?#]+)/);
  if (m) return { screen: "Order", params: { orderId: m[1] } };
  m = url.match(/^\/tickets\/([^/?#]+)/);
  if (m) return { screen: "Ticket", params: { ticketId: m[1] } };
  m = url.match(/^\/events\/([^/?#]+)/);
  if (m) return { screen: "EventDetails", params: { eventId: m[1] } };
  return { screen: "Tabs", params: { screen: "SupportTab" } };
}

// ---- datetime-local style values in the event's wall time (Asia/Almaty, UTC+5), like the web editor ----
export const toLocalInput = (iso, offsetHours = 5) =>
  iso ? new Date(new Date(iso).getTime() + offsetHours * 3600000).toISOString().slice(0, 16) : "";
export const fromLocalInput = (value, offset = "+05:00") => (value ? `${value}:00${offset}` : null);
export const isLocalInput = (value) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value);

// ---- iCalendar (.ics), same output as the web calendar.ts ----
function localStamp(iso, timeZone) {
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
      timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit"
    }).formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
    if (!parts.year) throw new Error("no tz");
    return `${parts.year}${parts.month}${parts.day}T${parts.hour}${parts.minute}${parts.second}`;
  } catch {
    // Kazakhstan: UTC+5 all year
    return new Date(new Date(iso).getTime() + 5 * 3600000).toISOString().replace(/[-:]/g, "").slice(0, 15);
  }
}

function offset(iso, timeZone) {
  const d = new Date(iso);
  const s = localStamp(iso, timeZone);
  const asUtc = Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(9, 11), +s.slice(11, 13), +s.slice(13, 15));
  const mins = Math.round((asUtc - d.getTime()) / 60000);
  const sign = mins >= 0 ? "+" : "-";
  const a = Math.abs(mins);
  return `${sign}${String(Math.floor(a / 60)).padStart(2, "0")}${String(a % 60).padStart(2, "0")}`;
}

const esc = (v) => String(v).replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
const fold = (line) => line.match(/.{1,73}/g).join("\r\n ");

export function buildIcs(event, eventUrl, now = new Date()) {
  const tz = event.timezone || "Asia/Almaty";
  const end = event.endsAt ?? new Date(new Date(event.startsAt).getTime() + 2 * 3600000).toISOString();
  const off = offset(event.startsAt, tz);
  const utcNow = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const location = [event.venueName, event.venueAddress].filter(Boolean).join(", ");
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//BiletFlow//Event Discovery//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VTIMEZONE", `TZID:${tz}`, "BEGIN:STANDARD", "DTSTART:19700101T000000",
    `TZOFFSETFROM:${off}`, `TZOFFSETTO:${off}`, "END:STANDARD", "END:VTIMEZONE",
    "BEGIN:VEVENT",
    `UID:event-${event.id}@biletflow`,
    `DTSTAMP:${utcNow}`,
    `DTSTART;TZID=${tz}:${localStamp(event.startsAt, tz)}`,
    `DTEND;TZID=${tz}:${localStamp(end, tz)}`,
    `SUMMARY:${esc(event.title)}`,
    `DESCRIPTION:${esc(`${event.description}\n\n${eventUrl}`)}`,
    `LOCATION:${esc(location)}`,
    `URL:${eventUrl}`,
    "END:VEVENT", "END:VCALENDAR"
  ].map(fold).join("\r\n") + "\r\n";
}

export function icsFileName(title) {
  return `${String(title).replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").toLowerCase() || "event"}.ics`;
}

// ---- Seating plan (biletflow_web HybridVenueMap) ----

/** Tier colours, most expensive tier first: blue, violet, emerald, amber, pink. */
export const SEAT_TIER_COLORS = [
  { fill: "#3b82f6", border: "#2563eb" },
  { fill: "#8b5cf6", border: "#7c3aed" },
  { fill: "#059669", border: "#047857" },
  { fill: "#d97706", border: "#b45309" },
  { fill: "#db2777", border: "#be185d" }
];

/** SVG geometry of the plan (viewBox 0 0 560 370), identical to the web. */
export const SEAT_PLAN = {
  width: 560, height: 370, rows: 8, seatSize: 19, seatGap: 6, aisleGap: 20, startY: 85, leftMargin: 44, rowPitch: 30
};

/** Tiers sorted by price, highest first (closest to the stage). */
export const orderTiersByPrice = (tiers) => [...tiers].sort((a, b) => b.priceKZT - a.priceKZT);

/** Tier id -> colour pair, in price order. */
export function tierColorMap(orderedTiers) {
  const map = new Map();
  orderedTiers.forEach((tier, i) => map.set(tier.id, SEAT_TIER_COLORS[i % SEAT_TIER_COLORS.length]));
  return map;
}

function tierForRow(ordered, row, totalRows) {
  if (ordered.length === 1) return ordered[0];
  if (ordered.length === 2) return row <= 3 ? ordered[0] : ordered[1];
  if (ordered.length === 3) return row <= 2 ? ordered[0] : row <= 5 ? ordered[1] : ordered[2];
  return ordered[Math.min(Math.floor(((row - 1) / totalRows) * ordered.length), ordered.length - 1)];
}

/**
 * Seats of the illustrative hall, same as the web: 8 rows, blocks of 4 | 10 | 4 seats, tiers by row
 * (most expensive in front). The plan is visual only: occupancy is a fixed pattern, and a sold-out
 * tier has every seat occupied. Booking passes only the tier to checkout, like the web.
 */
export function buildSeatPlan(tiers) {
  const ordered = orderTiersByPrice(tiers);
  if (!ordered.length) return { seats: [], rowCount: 0 };
  const { rows, seatSize, seatGap, aisleGap, startY, leftMargin } = SEAT_PLAN;
  const step = seatSize + seatGap;
  const centerStartX = leftMargin + 4 * step + aisleGap - seatGap;
  const rightStartX = centerStartX + 10 * step + aisleGap - seatGap;
  const blocks = [
    { block: "left", from: 1, to: 4, x0: leftMargin, taken: (r, s) => (r * 7 + s * 3) % 5 === 0 },
    { block: "center", from: 5, to: 14, x0: centerStartX, taken: (r, s) => (r * 11 + s * 2) % 6 === 0 },
    { block: "right", from: 15, to: 18, x0: rightStartX, taken: (r, s) => (r * 5 + s * 7) % 5 === 0 }
  ];
  const seats = [];
  for (let r = 1; r <= rows; r++) {
    const y = startY + (r - 1) * (step + 5);
    const tier = tierForRow(ordered, r, rows);
    const soldOut = tier.remaining !== null && tier.remaining === 0;
    for (const b of blocks) {
      for (let s = b.from; s <= b.to; s++) {
        seats.push({
          id: `seat-${r}-${s}`, rowNumber: r, seatNumber: s, tierId: tier.id, tierName: tier.name, priceKZT: tier.priceKZT,
          x: b.x0 + (s - b.from) * step, y, isOccupied: soldOut || b.taken(r, s), block: b.block
        });
      }
    }
  }
  return { seats, rowCount: rows };
}

/** Row-range label key for the tiers table (by price position), as on the web. */
export const tierRowsKey = (index) => (index === 0 ? "rowsVip" : index === 1 ? "rowsMid" : "rowsBack");
