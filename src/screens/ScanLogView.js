import { Platform, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { Badge, Button, Card } from "../components.js";
import { useI18n } from "../i18n.js";
import { toneFor } from "../qr.js";
import { SRS_TARGET_MS, formatScanLog, summarizeLatency } from "../stats.js";
import { colors } from "../theme.js";

// FS-22: timing record for online scans vs. the SRS two-second target (evidence for FS-24).
export default function ScanLogView({ event, entries }) {
  const { t } = useI18n();
  const summary = summarizeLatency(entries);
  const ms = (value) => (value == null ? "—" : `${value} ms`);

  async function share() {
    const message = formatScanLog(event, entries, `${Platform.OS} ${Platform.Version}`);
    try { await Share.share({ message }); } catch { /* user cancelled */ }
  }

  return (
    <ScrollView contentContainerStyle={st.pad}>
      <Text accessibilityRole="header" style={st.h3}>{t("log.title")}</Text>
      <View style={st.grid}>
        <Stat label={t("log.scans")} value={String(summary.count)} />
        <Stat label={t("log.median")} value={ms(summary.median)} />
        <Stat label={t("log.p95")} value={ms(summary.p95)} warn={summary.p95 != null && summary.p95 > SRS_TARGET_MS} />
        <Stat label={t("log.target")} value={summary.withinTargetPct == null ? "—" : `${summary.withinTargetPct}%`} />
      </View>
      <Text style={st.note}>{t("log.note")}</Text>
      {entries.length ? <Button variant="outlineBlue" label={t("log.share")} onPress={share} style={st.share} /> : null}

      {entries.length === 0 ? <Text style={st.empty}>{t("log.empty")}</Text> : (
        [...entries].reverse().map((entry, index) => {
          const copy = t(`result.${entry.code}`);
          const tone = toneFor(entry.code);
          return (
            <Card key={`${entry.at}-${index}`} style={st.row}>
              <View style={st.rowTop}>
                <Badge tone={tone} label={typeof copy === "object" ? copy.title : entry.code} />
                <Text style={[st.latency, entry.latencyMs > SRS_TARGET_MS && st.slow]}>{ms(entry.latencyMs)}</Text>
              </View>
              <Text style={st.meta}>{new Date(entry.at).toLocaleTimeString()}{entry.ticketId ? ` · ${entry.ticketId}` : ""}</Text>
            </Card>
          );
        })
      )}
    </ScrollView>
  );
}

function Stat({ label, value, warn }) {
  return (
    <Card style={st.stat}>
      <Text style={st.statLabel}>{label}</Text>
      <Text style={[st.statValue, warn && st.slow]}>{value}</Text>
    </Card>
  );
}

const st = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 32 },
  h3: { fontSize: 18, fontWeight: "700", color: colors.gray900, marginBottom: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: { flexGrow: 1, flexBasis: "45%", padding: 14 },
  statLabel: { fontSize: 13, color: colors.gray500 },
  statValue: { marginTop: 4, fontSize: 22, fontWeight: "700", color: colors.gray900 },
  note: { marginTop: 12, fontSize: 13, lineHeight: 19, color: colors.gray500 },
  share: { marginTop: 12 },
  empty: { marginTop: 20, fontSize: 14, color: colors.gray500, textAlign: "center" },
  row: { padding: 12, marginTop: 10 },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  latency: { fontSize: 14, fontWeight: "600", color: colors.gray700 },
  slow: { color: colors.red600 },
  meta: { marginTop: 6, fontSize: 12, color: colors.gray500 }
});
