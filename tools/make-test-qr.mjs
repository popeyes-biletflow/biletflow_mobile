#!/usr/bin/env node
// FS-22 / FS-24: printable QR test sheet for every scanner outcome, matching deploy/sql/demo_door_fixtures.sql.
// Signs payloads exactly like biletflow_web/backend/crypto.py:
//   ticket_id:event_id:user_id:expires_at:HMAC_SHA256(QR_SECRET, "ticket_id:event_id:user_id:expires_at")
//
// Usage (QR_SECRET must equal the backend's; it is read from the environment, never stored):
//   QR_SECRET=... node tools/make-test-qr.mjs --attendee <uuid> [--api http://192.168.0.157:8000] [--out deploy/qr-sheet.html]
// Open the HTML in a browser (needs internet for the QR renderer) and print it on A4, in grayscale too.
import { createHmac } from "node:crypto";
import { writeFileSync } from "node:fs";

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, arg, i, all) =>
  arg.startsWith("--") ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs, []));
const secret = process.env.QR_SECRET;
if (!secret || !args.attendee) {
  console.error("Usage: QR_SECRET=... node tools/make-test-qr.mjs --attendee <attendee uuid> [--api <origin>] [--out file]");
  process.exit(1);
}
const api = (args.api || "http://localhost:8000").replace(/\/+$/, "");
const out = args.out || "deploy/qr-sheet.html";

const EVENT_A = "b1e70000-0000-4000-8000-00000000000a";
const EVENT_B = "b1e70000-0000-4000-8000-00000000000b";
const T = (n) => `b1e70000-0000-4000-8000-000000000${n}`;
const future = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;
const past = Math.floor(Date.now() / 1000) - 3600;

export function sign(ticketId, eventId, userId, expiresAt, key = secret) {
  const sig = createHmac("sha256", key).update(`${ticketId}:${eventId}:${userId}:${expiresAt}`).digest("hex");
  return `${ticketId}:${eventId}:${userId}:${expiresAt}:${sig}`;
}

const valid = (n) => sign(T(n), EVENT_A, args.attendee, future);
const tampered = valid(102).slice(0, -1) + (valid(102).endsWith("0") ? "1" : "0");
const cases = [
  ["Valid #1 — expect: Valid, admitted. Scan again: Already used", valid(101)],
  ["Valid #2 — use for print-to-scan (paper + grayscale)", valid(102)],
  ["Valid #3 — use for two-device simultaneous scan", valid(103)],
  ["Already checked in — expect: Already used", valid(104)],
  ["Cancelled — expect: Cancelled or refunded", valid(105)],
  ["Refunded — expect: Cancelled or refunded", valid(106)],
  ["Ticket for Event B — expect: Wrong event (rejected on device, no request)", sign(T(201), EVENT_B, args.attendee, future)],
  ["Expired QR (valid ticket, past expiry) — expect: Expired", sign(T(103), EVENT_A, args.attendee, past)],
  ["Tampered signature — expect: Invalid ticket", tampered],
  ["Campaign QR (promo link) — expect: Promo QR, not a ticket", `${api}/c/demo-campaign`]
];

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const html = `<!doctype html><html><head><meta charset="utf-8"><title>BiletFlow scanner test sheet</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<style>
  @page { size: A4; margin: 12mm }
  body { font-family: system-ui, sans-serif; color: #111827 }
  h1 { font-size: 18px } p { font-size: 12px; color: #4b5563 }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10mm }
  .case { border: 1px solid #d1d5db; border-radius: 8px; padding: 6mm; break-inside: avoid }
  .case b { display: block; font-size: 12px; margin-bottom: 4mm }
  .qr { width: 45mm; height: 45mm } .qr img, .qr canvas { width: 45mm !important; height: 45mm !important }
  code { font-size: 8px; word-break: break-all; color: #6b7280 }
</style></head><body>
<h1>BiletFlow scanner test sheet — event "BiletFlow Door Demo"</h1>
<p>Synthetic fixtures only. Generated ${new Date().toISOString()}. Select the event in the app, then scan each code.</p>
<div class="grid">
${cases.map(([label, data], i) => `<div class="case"><b>${i + 1}. ${esc(label)}</b><div class="qr" id="q${i}"></div><code>${esc(data)}</code></div>`).join("\n")}
</div>
<script>
const data = ${JSON.stringify(cases.map((c) => c[1]))};
data.forEach((d, i) => new QRCode(document.getElementById("q" + i), { text: d, width: 360, height: 360, correctLevel: QRCode.CorrectLevel.M }));
</script></body></html>`;

writeFileSync(out, html);
console.log(`Wrote ${out} with ${cases.length} test codes.`);
