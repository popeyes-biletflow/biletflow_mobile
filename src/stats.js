// FS-22: summarize online scan latency against the SRS target
// ("QR validation should normally complete within two seconds").
export const SRS_TARGET_MS = 2000;

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

/** @param {{ latencyMs?: number | null }[]} entries */
export function summarizeLatency(entries) {
  const values = entries
    .map((entry) => entry.latencyMs)
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((a, b) => a - b);
  const within = values.filter((value) => value <= SRS_TARGET_MS).length;
  return {
    count: values.length,
    median: percentile(values, 50),
    p95: percentile(values, 95),
    max: values.length ? values[values.length - 1] : null,
    withinTarget: within,
    withinTargetPct: values.length ? Math.round((within / values.length) * 100) : null
  };
}

export function formatScanLog(event, entries, deviceLabel = "") {
  const summary = summarizeLatency(entries);
  const lines = [
    `BiletFlow scan timing — ${event.name} (${event.id})`,
    deviceLabel ? `Device: ${deviceLabel}` : null,
    `Online scans timed: ${summary.count}; median ${summary.median ?? "-"} ms; p95 ${summary.p95 ?? "-"} ms; max ${summary.max ?? "-"} ms`,
    `Within ${SRS_TARGET_MS} ms target: ${summary.withinTarget}/${summary.count}` +
      (summary.withinTargetPct == null ? "" : ` (${summary.withinTargetPct}%)`),
    "",
    "time,result,ticket,latency_ms",
    ...entries.map((entry) =>
      [entry.at, entry.code, entry.ticketId || "", entry.latencyMs ?? ""].join(","))
  ];
  return lines.filter((line) => line !== null).join("\n");
}
