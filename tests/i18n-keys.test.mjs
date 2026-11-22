import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { hasKey, translate } from "../src/strings.js";

// Every literal t("...") key used by the app must resolve in KK, RU and EN (web dictionaries + mobile additions).
function sources(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? (d.name === "locales" ? [] : sources(join(dir, d.name))) : d.name.endsWith(".js") ? [join(dir, d.name)] : []);
}

const files = [...sources("src"), "App.js"];
const keys = new Set();
for (const file of files) {
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(/\bt\(\s*"([a-zA-Z0-9_.]+)"/g)) keys.add(m[1]);
}

test("all translation keys used in the app resolve in kk, ru and en (web fallback: ru)", () => {
  const missing = [];
  for (const key of keys) {
    for (const lang of ["kk", "ru", "en"]) {
      // plural keys resolve via _one/_other
      const ok = hasKey(lang, key) || translate(lang, key, { count: 2 }) !== key;
      if (!ok) missing.push(`${lang}:${key}`);
    }
  }
  assert.deepEqual(missing, []);
  assert.ok(keys.size > 250, `scanned ${keys.size} keys`);
});

test("plural forms follow the language rules", () => {
  assert.match(translate("ru", "discovery.results", { count: 1 }), /1/);
  assert.notEqual(translate("ru", "discovery.results", { count: 2 }), translate("ru", "discovery.results", { count: 5 }));
  assert.equal(translate("en", "discovery.results", { count: 1 }), "1 event");
  assert.equal(translate("en", "discovery.results", { count: 3 }), "3 events");
});
