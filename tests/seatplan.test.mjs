import { test } from "node:test";
import assert from "node:assert/strict";
import { SEAT_TIER_COLORS, buildSeatPlan, orderTiersByPrice, tierColorMap, tierRowsKey } from "../src/models.js";

// Parity with biletflow_web HybridVenueMap (seat generation is visual only, booking passes the tier).
const tier = (id, priceKZT, remaining = null) => ({ id, name: id.toUpperCase(), priceKZT, remaining });
const rowTiers = (plan) => {
  const byRow = new Map();
  for (const s of plan.seats) byRow.set(s.rowNumber, s.tierId);
  return [...byRow.values()];
};

test("no tiers -> empty plan", () => {
  assert.deepEqual(buildSeatPlan([]), { seats: [], rowCount: 0 });
});

test("8 rows of 4 | 10 | 4 seats with the web geometry", () => {
  const { seats, rowCount } = buildSeatPlan([tier("a", 1000)]);
  assert.equal(rowCount, 8);
  assert.equal(seats.length, 8 * 18);
  const at = (r, s) => seats.find((x) => x.id === `seat-${r}-${s}`);
  assert.deepEqual([at(1, 1).x, at(1, 1).y, at(1, 1).block], [44, 85, "left"]);
  assert.deepEqual([at(1, 5).x, at(1, 5).block], [158, "center"]);
  assert.deepEqual([at(1, 14).x, at(1, 14).block], [383, "center"]);
  assert.deepEqual([at(1, 15).x, at(1, 15).block], [422, "right"]);
  assert.equal(at(1, 18).x, 497);
  assert.equal(at(8, 1).y, 85 + 7 * 30);
});

test("most expensive tier sits in front; row split by tier count", () => {
  const a = tier("a", 9000), b = tier("b", 5000), c = tier("c", 2000), d = tier("d", 0);
  assert.deepEqual(rowTiers(buildSeatPlan([b, a])), ["a", "a", "a", "b", "b", "b", "b", "b"]);
  assert.deepEqual(rowTiers(buildSeatPlan([c, a, b])), ["a", "a", "b", "b", "b", "c", "c", "c"]);
  assert.deepEqual(rowTiers(buildSeatPlan([d, c, b, a])), ["a", "a", "b", "b", "c", "c", "d", "d"]);
});

test("occupancy follows the web pattern; a sold-out tier is fully occupied", () => {
  const { seats } = buildSeatPlan([tier("a", 1000)]);
  const occupied = (r, s) => seats.find((x) => x.id === `seat-${r}-${s}`).isOccupied;
  assert.equal(occupied(1, 1), true);   // (1*7 + 1*3) % 5 === 0
  assert.equal(occupied(1, 2), false);
  assert.equal(occupied(3, 6), false);  // centre: (3*11 + 6*2) % 6 === 3
  assert.equal(occupied(2, 7), true);   // centre: (2*11 + 7*2) % 6 === 0
  assert.equal(occupied(1, 15), true);  // right: (1*5 + 15*7) % 5 === 0
  assert.equal(occupied(1, 16), false);
  const sold = buildSeatPlan([tier("vip", 9000, 0), tier("std", 1000, 50)]);
  assert.ok(sold.seats.filter((x) => x.tierId === "vip").every((x) => x.isOccupied));
  assert.ok(sold.seats.filter((x) => x.tierId === "std").some((x) => !x.isOccupied));
});

test("tier colours and row labels follow price order", () => {
  const ordered = orderTiersByPrice([tier("cheap", 100), tier("vip", 9000)]);
  assert.deepEqual(ordered.map((x) => x.id), ["vip", "cheap"]);
  const colors = tierColorMap(ordered);
  assert.equal(colors.get("vip"), SEAT_TIER_COLORS[0]);
  assert.equal(colors.get("cheap"), SEAT_TIER_COLORS[1]);
  assert.deepEqual([0, 1, 2, 5].map(tierRowsKey), ["rowsVip", "rowsMid", "rowsBack", "rowsBack"]);
});
