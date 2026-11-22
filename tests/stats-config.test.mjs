import { test } from "node:test";
import assert from "node:assert/strict";
import { formatScanLog, summarizeLatency } from "../src/stats.js";
import { validateApiUrl } from "../src/apiConfig.js";
import { DICTIONARIES, formatEventDate, translate } from "../src/strings.js";

test("FS-22: latency summary compares online scans with the 2 s SRS target", () => {
  const summary = summarizeLatency([
    { latencyMs: 300 }, { latencyMs: 450 }, { latencyMs: 2500 }, { latencyMs: null }, { latencyMs: 600 }
  ]);
  assert.deepEqual(summary, { count: 4, median: 450, p95: 2500, max: 2500, withinTarget: 3, withinTargetPct: 75 });
  assert.equal(summarizeLatency([]).count, 0);
  const text = formatScanLog({ id: "e1", name: "Concert" }, [{ at: "2026-12-01T10:00:00Z", code: "CHECKED_IN", ticketId: "t1", latencyMs: 300 }], "ios 18");
  assert.match(text, /Within 2000 ms target: 1\/1 \(100%\)/);
  assert.match(text, /2026-12-01T10:00:00Z,CHECKED_IN,t1,300/);
});

test("FS-21: API origin rules for devices, emulators and release builds", () => {
  assert.equal(validateApiUrl("http://192.168.0.157:8000/", { development: true }), "http://192.168.0.157:8000");
  assert.equal(validateApiUrl("http://10.0.2.2:8000", { development: true }), "http://10.0.2.2:8000");
  assert.equal(validateApiUrl("http://127.0.0.1:8000", { development: true }), "http://127.0.0.1:8000");
  assert.equal(validateApiUrl("https://api.biletflow.kz"), "https://api.biletflow.kz");
  assert.throws(() => validateApiUrl("http://192.168.0.157:8000"), /HTTPS/);
  assert.throws(() => validateApiUrl("http://example.com", { development: true }), /HTTPS/);
  assert.throws(() => validateApiUrl("https://abc.supabase.co"), /Supabase/);
  assert.throws(() => validateApiUrl("https://api.biletflow.kz/api"), /origin only/);
  assert.throws(() => validateApiUrl(""), /EXPO_PUBLIC_API_URL/);
});

test("KK/RU/EN dictionaries define the same keys", () => {
  const keys = (node, prefix = "") => Object.entries(node).flatMap(([key, value]) =>
    value && typeof value === "object" && !Array.isArray(value) ? keys(value, `${prefix}${key}.`) : [`${prefix}${key}`]);
  const en = keys(DICTIONARIES.en).sort();
  assert.deepEqual(keys(DICTIONARIES.ru).sort(), en);
  assert.deepEqual(keys(DICTIONARIES.kk).sort(), en);
});

test("dates use the web card format in the event time zone", () => {
  assert.equal(formatEventDate("en", "2026-12-01T10:00:00Z", "Asia/Almaty"), "1 Dec 2026, 15:00");
  assert.equal(formatEventDate("ru", "2026-12-01T10:00:00Z", "Asia/Almaty"), "1 дек. 2026, 15:00");
  assert.equal(formatEventDate("kk", "2026-12-01T10:00:00Z", "Asia/Almaty"), "2026 ж. 1 жел., 15:00");
  assert.equal(formatEventDate("en", ""), "Date to be announced");
  assert.equal(translate("ru", "event.of", { total: 12 }), "из 12");
});
