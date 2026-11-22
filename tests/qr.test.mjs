import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyQr, codeFromVerifyError, toneFor } from "../src/qr.js";

const SIG = "a".repeat(64);
const ticket = (eventId = "e1", ticketId = "t1") => `${ticketId}:${eventId}:u1:9999999999:${SIG}`;

test("accepts a signed ticket payload for the selected event", () => {
  assert.deepEqual(classifyQr(` ${ticket()} `, "e1"), { ok: true, ticketId: "t1", payload: ticket() });
});

test("FS-22: campaign QR links are rejected locally and never treated as tickets", () => {
  for (const data of [
    "https://api.biletflow.kz/c/spring-sale",
    "http://192.168.0.157:8000/c/abc123",
    "https://biletflow.kz/events/e1?promo=SPRING",
    "/checkout?promo=CODE"
  ]) {
    assert.equal(classifyQr(data, "e1").code, "CAMPAIGN_QR", data);
  }
});

test("wrong-event tickets are rejected before the admission request", () => {
  assert.deepEqual(classifyQr(ticket("other"), "e1"), { ok: false, code: "WRONG_EVENT", ticketId: "t1" });
});

test("malformed payloads are not tickets", () => {
  assert.equal(classifyQr("", "e1").code, "UNREADABLE");
  assert.equal(classifyQr(null, "e1").code, "UNREADABLE");
  assert.equal(classifyQr("hello", "e1").code, "INVALID_FORMAT");
  assert.equal(classifyQr(`t1:e1:u1:notanumber:${SIG}`, "e1").code, "INVALID_FORMAT");
  assert.equal(classifyQr("t1:e1:u1:9999999999:short", "e1").code, "INVALID_FORMAT");
  assert.equal(classifyQr(`t1::u1:9999999999:${SIG}`, "e1").code, "INVALID_FORMAT");
});

test("maps FastAPI rejections to specific result codes", () => {
  assert.equal(codeFromVerifyError(409, "Ticket has already been used."), "ALREADY_USED");
  assert.equal(codeFromVerifyError(400, "This ticket belongs to a different event."), "WRONG_EVENT");
  assert.equal(codeFromVerifyError(400, "QR code has expired."), "EXPIRED");
  assert.equal(codeFromVerifyError(400, "Ticket is cancelled or refunded."), "CANCELLED_OR_REFUNDED");
  assert.equal(codeFromVerifyError(400, "This ticket was refunded and is no longer valid."), "REFUNDED");
  assert.equal(codeFromVerifyError(400, "This ticket was cancelled."), "CANCELLED");
  assert.equal(codeFromVerifyError(404, "Ticket not found."), "NOT_FOUND");
  assert.equal(codeFromVerifyError(400, "Signature mismatch – QR payload may be tampered."), "INVALID_SIGNATURE");
  assert.equal(codeFromVerifyError(400, "Invalid QR payload format."), "INVALID_SIGNATURE");
  assert.equal(codeFromVerifyError(400, "Something else"), "INVALID");
});

test("result tones: success, warning, info and error are distinct", () => {
  assert.equal(toneFor("CHECKED_IN"), "success");
  assert.equal(toneFor("ALREADY_USED"), "warning");
  assert.equal(toneFor("OFFLINE"), "warning");
  assert.equal(toneFor("REVERSED"), "info");
  assert.equal(toneFor("CAMPAIGN_QR"), "error");
  assert.equal(toneFor("REFUNDED"), "error");
});
