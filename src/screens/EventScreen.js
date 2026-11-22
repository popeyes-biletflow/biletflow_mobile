import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, Text, View } from "react-native";
import { Button, Card, ConfirmDialog, LinkButton, Notice, PillTabs } from "../components.js";
import { useI18n } from "../i18n.js";
import { formatClock } from "../strings.js";
import { colors } from "../theme.js";
import ScannerView from "./ScannerView.js";
import AttendeesView from "./AttendeesView.js";
import ScanLogView from "./ScanLogView.js";

const POLL_MS = 5000;
const SEARCH_DEBOUNCE_MS = 300;

export default function EventScreen({ event, client, scanLog, onScanLogged, onBack, onRevoked }) {
  const { t, formatDate } = useI18n();
  const [tab, setTab] = useState("scanner");
  const [counts, setCounts] = useState(null);
  const [sync, setSync] = useState("connecting"); // connecting | synced | offline | failed | paused
  const [lastSync, setLastSync] = useState(null);
  const [syncError, setSyncError] = useState("");
  const [revoked, setRevoked] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === "active" || AppState.currentState == null);
  const [revision, setRevision] = useState(0);

  // roster
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [cursors, setCursors] = useState([""]);
  const [nextCursor, setNextCursor] = useState(null);
  const [rows, setRows] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(true);

  // writes
  const [pendingTicket, setPendingTicket] = useState(null);
  const [notice, setNotice] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const mutating = useRef(false);
  const generation = useRef(0);
  const alive = useRef(true);
  const cursor = cursors[cursors.length - 1];

  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  const handleForbidden = useCallback(() => {
    setRevoked(true);
    onRevoked?.();
  }, [onRevoked]);

  useEffect(() => {
    alive.current = true;
    const subscription = AppState.addEventListener("change", (state) => {
      const active = state === "active";
      setForeground(active);
      setSync(active ? "connecting" : "paused");
      if (active) setRevision((value) => value + 1); // server refresh after foregrounding
    });
    return () => { alive.current = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setCursors([""]);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  // Polling: counters always, roster while its tab is open. Next poll starts after the previous finishes.
  useEffect(() => {
    if (!foreground || revoked) return undefined;
    let active = true;
    let timer;
    const version = ++generation.current;
    const wantRoster = tab === "attendees";
    if (wantRoster) setRosterLoading(true);

    async function run() {
      if (!active || version !== generation.current) return;
      if (mutating.current) { timer = setTimeout(run, 800); return; }
      try {
        const [attendance, page] = await Promise.all([
          client.getAttendance(event.id),
          wantRoster ? client.getAttendees(event.id, query, cursor) : Promise.resolve(null)
        ]);
        if (!active || version !== generation.current) return;
        setCounts(attendance);
        if (page) { setRows(page.attendees); setNextCursor(page.nextCursor); }
        setLastSync(new Date());
        setSync("synced");
        setSyncError("");
      } catch (error) {
        if (!active || version !== generation.current) return;
        if (error.code === "FORBIDDEN") { handleForbidden(); return; }
        if (error.code === "SESSION_EXPIRED") return;
        setSync(error.code === "NETWORK" ? "offline" : "failed");
        setSyncError(error.code === "NETWORK" ? "" : error.message);
      } finally {
        if (active && version === generation.current) {
          setRosterLoading(false);
          timer = setTimeout(run, POLL_MS);
        }
      }
    }
    run();
    return () => { active = false; clearTimeout(timer); };
  }, [client, event.id, tab, query, cursor, revision, foreground, revoked, handleForbidden]);

  const writesAllowed = sync === "synced" && foreground && !revoked && !pendingTicket;
  const canUndo = counts?.canUndoCheckIn === true;

  // Returns true when the server committed the write.
  async function mutate(kind, ticketId, name) {
    if (mutating.current) return false;
    mutating.current = true;
    setPendingTicket(ticketId);
    setNotice(null);
    let ok = false;
    try {
      if (kind === "undo") await client.undoCheckIn(event.id, ticketId);
      else await client.checkIn(event.id, ticketId);
      ok = true;
      if (alive.current) {
        setNotice({ tone: kind === "undo" ? "info" : "success", text: t(kind === "undo" ? "attendees.reversed" : "attendees.done", { name }) });
      }
    } catch (error) {
      if (!alive.current) return false;
      if (error.code === "NETWORK") setNotice({ tone: "warning", text: t("attendees.unknown") });
      else if (error.code === "FORBIDDEN" && kind === "undo" && !revoked) setNotice({ tone: "error", text: `${t("attendees.undoDenied")} (${error.detail})` });
      else if (error.code === "FORBIDDEN") handleForbidden();
      else if (error.status === 409) setNotice({ tone: "warning", text: t("attendees.alreadyUsed") });
      else if (error.code !== "SESSION_EXPIRED") setNotice({ tone: "error", text: error.message });
    } finally {
      mutating.current = false;
      if (alive.current) { setPendingTicket(null); refresh(); }
    }
    return ok;
  }

  function askCheckIn(item) {
    setConfirm({
      title: t("attendees.confirmCheckIn"),
      body: `${item.name}${item.email ? `\n${item.email}` : ""}\n${t("attendees.ticket")}: ${item.ticketId}`,
      confirmLabel: t("attendees.checkIn"),
      run: () => mutate("checkin", item.ticketId, item.name)
    });
  }

  function askUndo(ticketId, name) {
    return new Promise((resolve) => {
      setConfirm({
        title: t("attendees.confirmUndo"),
        body: `${name ? `${name}\n` : ""}${t("attendees.ticket")}: ${ticketId}\n\n${t("attendees.confirmUndoBody")}`,
        confirmLabel: t("attendees.undo"),
        danger: true,
        run: () => mutate("undo", ticketId, name || ticketId).then(resolve),
        cancel: () => resolve(false)
      });
    });
  }

  const pct = counts && counts.total > 0 ? Math.round((counts.checkedIn / counts.total) * 100) : 0;
  const statusText = sync === "synced" && lastSync ? t("event.status.synced", { time: formatClock(lastSync) }) : t(`event.status.${sync}`);
  const statusColor = sync === "synced" ? colors.emerald600 : sync === "connecting" ? colors.gray500 : colors.amber500;

  return (
    <View style={st.screen}>
      <View style={st.header}>
        <LinkButton label={t("nav.back")} onPress={onBack} disabled={!!pendingTicket} />
        <Text accessibilityRole="header" style={st.title}>{event.name}</Text>
        <Text style={st.meta}>{formatDate(event.startsAt, event.timezone)}{event.venue ? ` · ${event.venue}` : ""}</Text>

        <Card style={st.counter}>
          <View style={st.counterRow}>
            <View>
              <Text style={st.counterLabel}>{t("event.checkedIn")}</Text>
              {counts ? (
                <Text accessibilityLiveRegion="polite" style={st.counterValue}>
                  {counts.checkedIn} <Text style={st.counterOf}>{t("event.of", { total: counts.total })}</Text>
                </Text>
              ) : <Text style={st.counterOf}>{t("event.countsUnavailable")}</Text>}
            </View>
            {counts ? <Text style={st.pct}>{pct}%</Text> : null}
          </View>
          <View style={st.bar}><View style={[st.barFill, { width: `${pct}%` }]} /></View>
          <View style={st.statusRow}>
            <View style={[st.dot, { backgroundColor: statusColor }]} />
            <Text accessibilityLiveRegion="polite" style={st.status}>{statusText}</Text>
          </View>
        </Card>

        {revoked ? (
          <Notice tone="error" role="alert" style={st.gap}>
            <Text style={st.noticeText}>{t("event.revoked")}</Text>
            <View style={st.noticeAction}><Button small variant="outline" label={t("event.backToEvents")} onPress={onBack} /></View>
          </Notice>
        ) : sync === "offline" || sync === "failed" ? (
          <Notice tone="warning" style={st.gap}>{`${t("event.staleWrites")}${syncError ? `\n${syncError}` : ""}`}</Notice>
        ) : null}
        {notice ? <Notice tone={notice.tone} role={notice.tone === "error" ? "alert" : undefined} style={st.gap}>{notice.text}</Notice> : null}

        <View style={st.gap}>
          <PillTabs value={tab} onChange={setTab} disabled={!!pendingTicket}
            tabs={[
              { value: "scanner", label: t("event.tabs.scanner") },
              { value: "attendees", label: t("event.tabs.attendees") },
              { value: "log", label: `${t("event.tabs.log")} (${scanLog.length})` }
            ]} />
        </View>
      </View>

      <View style={st.body}>
        {tab === "scanner" ? (
          <ScannerView event={event} client={client} active={foreground && !revoked} canUndo={canUndo}
            writesAllowed={writesAllowed}
            onScanned={(entry) => { onScanLogged(entry); if (!entry.local) refresh(); }}
            onForbidden={handleForbidden}
            onUndo={(ticketId) => askUndo(ticketId)} />
        ) : tab === "attendees" ? (
          <AttendeesView search={search} onSearch={(value) => { setSearch(value); setRosterLoading(true); }}
            rows={rows} loading={rosterLoading} error={sync === "failed" || sync === "offline"}
            page={cursors.length} hasPrev={cursors.length > 1} hasNext={!!nextCursor && nextCursor !== cursor}
            onPrev={() => setCursors((value) => value.slice(0, -1))}
            onNext={() => setCursors((value) => [...value, nextCursor])}
            onRefresh={refresh} canUndo={canUndo} writesAllowed={writesAllowed} pendingTicket={pendingTicket}
            onCheckIn={askCheckIn} onUndo={(item) => askUndo(item.ticketId, item.name)} />
        ) : (
          <ScanLogView event={event} entries={scanLog} />
        )}
      </View>

      <ConfirmDialog visible={!!confirm} title={confirm?.title} body={confirm?.body}
        confirmLabel={confirm?.confirmLabel || ""} cancelLabel={t("common.cancel")} danger={confirm?.danger}
        onCancel={() => { confirm?.cancel?.(); setConfirm(null); }}
        onConfirm={() => { const action = confirm?.run; setConfirm(null); action?.(); }} />
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.gray50 },
  header: { paddingHorizontal: 16, paddingTop: 14 },
  title: { marginTop: 8, fontSize: 24, fontWeight: "700", color: colors.gray900 },
  meta: { marginTop: 2, fontSize: 14, color: colors.gray600 },
  counter: { marginTop: 14, padding: 14 },
  counterRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  counterLabel: { fontSize: 13, color: colors.gray500 },
  counterValue: { marginTop: 2, fontSize: 28, fontWeight: "700", color: colors.gray900 },
  counterOf: { fontSize: 15, fontWeight: "500", color: colors.gray500 },
  pct: { fontSize: 18, fontWeight: "700", color: colors.blue600 },
  bar: { marginTop: 10, height: 8, borderRadius: 4, backgroundColor: colors.gray100, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4, backgroundColor: colors.blue600 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  status: { fontSize: 12, color: colors.gray600, flex: 1 },
  gap: { marginTop: 12 },
  noticeText: { fontSize: 14, lineHeight: 20, color: colors.red700 },
  noticeAction: { marginTop: 10, alignItems: "flex-start" },
  body: { flex: 1, marginTop: 4 }
});
