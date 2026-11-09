import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { API_CAPABILITIES, getEventConnection, checkInAttendee, getAttendance, getAttendees, isNetworkError, undoCheckIn } from "./adminApi";

function Button({ label, onPress, disabled }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[s.button, disabled && s.disabled]}><Text style={s.link}>{label}</Text></Pressable>;
}

export default function EventOperations({ event, token, onBack, renderScanner }) {
  const [tab, setTab] = useState(API_CAPABILITIES.attendeeOperations ? "attendees" : "scanner");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [cursors, setCursors] = useState([""]);
  const [nextCursor, setNextCursor] = useState(null);
  const [rows, setRows] = useState([]);
  const [attendance, setAttendance] = useState(null);
  const [status, setStatus] = useState("Connecting");
  const [lastSync, setLastSync] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [foreground, setForeground] = useState(AppState.currentState !== "background");
  const alive = useRef(false);
  const generation = useRef(0);
  const mutation = useRef(false);
  const cursor = cursors[cursors.length - 1];

  function invalidate() {
    generation.current += 1;
    setStatus("Syncing");
    setLoading(true);
  }

  function refresh() {
    invalidate();
    setRevision((value) => value + 1);
  }

  useEffect(() => {
    alive.current = true;
    const subscription = AppState.addEventListener("change", (state) => {
      generation.current += 1;
      setStatus(state === "active" ? "Syncing" : "Paused");
      setForeground(state === "active");
      if (state === "active") setRevision((value) => value + 1);
    });
    return () => { alive.current = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setCursors([""]);
      setRevision((value) => value + 1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!foreground) return;
    let active = true;
    let timer;
    const version = ++generation.current;
    async function sync() {
      if (!active || version !== generation.current) return;
      if (mutation.current) {
        timer = setTimeout(sync, 1000);
        return;
      }
      try {
        if (!API_CAPABILITIES.attendeeOperations) {
          await getEventConnection(token, event.id);
          if (!active || version !== generation.current) return;
          setLastSync(new Date());
          setStatus("Connected");
          setError("");
          return;
        }
        const [counts, page] = await Promise.all([
          getAttendance(token, event.id), getAttendees(token, event.id, query, cursor)
        ]);
        if (!active || version !== generation.current) return;
        setAttendance(counts);
        setRows(page.attendees);
        setNextCursor(page.nextCursor);
        setLastSync(new Date());
        setStatus("Synced");
        setError("");
      } catch (failure) {
        if (!active || version !== generation.current) return;
        setStatus(isNetworkError(failure) ? "Offline · data may be outdated" : "Sync failed · data may be outdated");
        setError(failure.message || "Unable to synchronize.");
      } finally {
        if (active && version === generation.current) {
          setLoading(false);
          timer = setTimeout(sync, 5000);
        }
      }
    }
    sync();
    return () => { active = false; clearTimeout(timer); };
  }, [token, event.id, query, cursor, revision, foreground]);

  async function mutate(ticketId, undo, onSuccess) {
    if (mutation.current || !alive.current) return;
    mutation.current = true;
    setPending(ticketId);
    setNotice("");
    invalidate();
    try {
      await (undo ? undoCheckIn : checkInAttendee)(token, event.id, ticketId);
      if (alive.current) {
        setNotice(undo ? "Check-in reversed." : "Attendee checked in.");
        onSuccess?.();
      }
    } catch (failure) {
      if (alive.current) setNotice(isNetworkError(failure)
        ? "The result is unknown. Wait for synchronization and check the ticket status before trying again."
        : failure.message || "The action failed.");
    } finally {
      mutation.current = false;
      if (alive.current) {
        setPending(null);
        refresh();
      }
    }
  }

  function confirm(ticketId, name, undo, onSuccess) {
    Alert.alert(undo ? "Undo check-in?" : "Check in attendee?", `${name}\nTicket: ${ticketId}`, [
      { text: "Cancel", style: "cancel" },
      { text: undo ? "Undo check-in" : "Check in", onPress: () => mutate(ticketId, undo, onSuccess) }
    ]);
  }

  const ready = status === "Synced" && !loading && pending === null && !scanBusy && foreground;
  const canUndo = ready && attendance?.canUndoCheckIn === true;

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <View style={s.row}>
          <Button label="‹ Events" disabled={pending !== null || scanBusy} onPress={onBack} />
          <Text style={s.title} numberOfLines={1}>{event.name}</Text>
          <Button label="Refresh" disabled={pending !== null || !foreground} onPress={refresh} />
        </View>
        <Text accessibilityLiveRegion="polite" style={s.counter}>{attendance ? `${attendance.checkedIn} / ${attendance.total} Checked In` : "Attendance counters unavailable"}</Text>
        <Text accessibilityLiveRegion="polite" style={s.meta}>{status}{lastSync ? ` · ${API_CAPABILITIES.attendeeOperations ? "Last sync" : "Last connection check"} ${lastSync.toLocaleTimeString()}` : ""}</Text>
        <View style={s.row}>
          {["attendees", "scanner"].map((value) => (
            <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: tab === value }} disabled={pending !== null || scanBusy} onPress={() => setTab(value)} style={[s.tab, tab === value && s.selected]}>
              <Text style={s.text}>{value === "attendees" ? "Attendee search" : "QR scanner"}</Text>
            </Pressable>
          ))}
        </View>
        {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
        {notice ? <Text accessibilityLiveRegion="polite" style={s.text}>{notice}</Text> : null}
      </View>
      {tab === "scanner" ? renderScanner({
        onValidated: refresh,
        onBusyChange: setScanBusy,
        active: foreground,
        canUndo,
        undoBusy: pending !== null,
        onUndo: (ticketId, onSuccess) => confirm(ticketId, "Reverse the admission for this ticket?", true, onSuccess)
      }) : !API_CAPABILITIES.attendeeOperations ? (
        <View style={s.body}>
          <Text style={s.name}>Attendee operations unavailable</Text>
          <Text style={s.meta}>This platform version supports QR check-in. Attendee search, manual check-in, undo, and attendance counters require a platform update.</Text>
          <Button label="Open QR scanner" onPress={() => setTab("scanner")} />
        </View>
      ) : (
        <View style={s.body}>
          <TextInput accessibilityLabel="Search by attendee name, email, or ticket ID" placeholder="Name, email, or ticket ID" placeholderTextColor="#9A9E91" autoCapitalize="none" autoCorrect={false} value={search}
            onChangeText={(value) => { invalidate(); setRows([]); setNextCursor(null); setSearch(value); }} style={s.input} />
          {loading && <ActivityIndicator color="#D6FB54" />}
          <FlatList data={rows} keyExtractor={(item) => item.ticketId} keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={s.meta}>{loading ? "Loading attendees…" : error ? "Attendees unavailable. Refresh to retry." : "No attendees found."}</Text>}
            renderItem={({ item }) => (
              <View style={s.card}>
                <Text style={s.name}>{item.name}</Text>
                <Text style={s.meta}>{item.email}</Text>
                <Text selectable style={s.meta}>Ticket: {item.ticketId}</Text>
                <Text style={s.text}>{item.checkedIn ? "Checked in" : "Not checked in"}</Text>
                {(!item.checkedIn || attendance?.canUndoCheckIn === true) && (
                  <Button disabled={!ready} label={pending === item.ticketId ? "Saving…" : item.checkedIn ? "Undo check-in" : "Check in manually"}
                    onPress={() => confirm(item.ticketId, `${item.name}\n${item.email}`, item.checkedIn)} />
                )}
              </View>
            )}
          />
          <View style={s.row}>
            <Button label="Previous" disabled={!ready || cursors.length === 1} onPress={() => { invalidate(); setCursors((value) => value.slice(0, -1)); }} />
            <Text style={s.meta}>Page {cursors.length}</Text>
            <Button label="Next" disabled={!ready || !nextCursor || nextCursor === cursor} onPress={() => { invalidate(); setCursors((value) => [...value, nextCursor]); }} />
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0B0D0A", paddingTop: 42 },
  header: { paddingHorizontal: 16, gap: 8, paddingBottom: 10 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  title: { flex: 1, color: "#F5F6F0", fontSize: 16, fontWeight: "700" },
  counter: { color: "#D6FB54", fontSize: 23, fontWeight: "700" },
  meta: { color: "#9A9E91", fontSize: 12, lineHeight: 20 },
  link: { color: "#D6FB54", fontWeight: "700" },
  text: { color: "#F5F6F0", lineHeight: 21 },
  tab: { flex: 1, padding: 10, borderRadius: 10, backgroundColor: "#151813", borderWidth: 1, borderColor: "#2A3024", alignItems: "center" },
  selected: { borderColor: "#D6FB54" },
  body: { flex: 1, paddingHorizontal: 16, paddingBottom: 24 },
  input: { color: "#F5F6F0", padding: 14, backgroundColor: "#151813", borderRadius: 10, marginBottom: 12 },
  card: { padding: 16, borderRadius: 12, backgroundColor: "#151813", marginBottom: 12, gap: 4 },
  name: { color: "#F5F6F0", fontSize: 17, fontWeight: "700" },
  button: { paddingVertical: 12, paddingHorizontal: 4 },
  disabled: { opacity: 0.4 },
  error: { color: "#FF8D80", fontSize: 12 }
});
