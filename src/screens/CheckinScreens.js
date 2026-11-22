import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../auth.js";
import { useI18n } from "../i18n.js";
import { cacheEvents, getCachedEvents } from "../localCache.js";
import EventsScreen from "./EventsScreen.js";
import EventScreen from "./EventScreen.js";

// Scan logs live in memory for the session (FS-22 timing record) and disappear on sign-out.
const ScanLogContext = createContext({ logs: {}, add: () => {} });

export function ScanLogProvider({ children }) {
  const { user } = useAuth();
  const [logs, setLogs] = useState({});
  useEffect(() => { setLogs({}); }, [user?.id]);
  const add = useCallback((eventId, entry) => {
    setLogs((all) => ({ ...all, [eventId]: [...(all[eventId] || []), entry].slice(-500) }));
  }, []);
  const value = useMemo(() => ({ logs, add }), [logs, add]);
  return <ScanLogContext.Provider value={value}>{children}</ScanLogContext.Provider>;
}

function accessFor(event, user) {
  if (user.role === "platform_admin" || user.role === "admin") return "admin";
  if (event.organizerId && event.organizerId === user.id) return "owner";
  if (user.role === "event_admin" || (user.role === "organizer" && event.organizerId)) return "staff";
  return null;
}

// FS-21: events from the assignment API; offline falls back to the per-user cache.
export function CheckinEventsScreen({ navigation }) {
  const { client, user } = useAuth();
  const { t } = useI18n();
  const [events, setEvents] = useState([]);
  const [state, setState] = useState({ loading: true, refreshing: false, error: "", offline: false });

  const load = useCallback(async (quiet) => {
    if (!user) return;
    setState((s) => ({ ...s, loading: quiet ? s.loading : true, refreshing: !!quiet, error: "" }));
    try {
      const list = (await client.getAssignedEvents()).map((e) => ({ ...e, access: accessFor(e, user) }));
      setEvents(list);
      setState({ loading: false, refreshing: false, error: "", offline: false });
      cacheEvents(user, list).catch(() => {});
    } catch (error) {
      if (error.code === "SESSION_EXPIRED") return;
      if (error.code === "NETWORK") {
        const cached = await getCachedEvents(user.id).catch(() => null);
        if (cached) setEvents(cached.events);
        setState({ loading: false, refreshing: false, error: cached ? "" : t("auth.errors.NETWORK"), offline: !!cached });
        return;
      }
      setState({ loading: false, refreshing: false, error: `${t("events.loadFailed")} ${error.message}`, offline: false });
    }
  }, [client, user, t]);

  useFocusEffect(useCallback(() => { load(events.length > 0); }, [load])); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <EventsScreen user={user} events={events} loading={state.loading} refreshing={state.refreshing}
      error={state.error} offline={state.offline} onRefresh={() => load(true)}
      onOpen={(event) => navigation.navigate("CheckinEvent", { event })} />
  );
}

export function CheckinEventScreen({ route, navigation }) {
  const { event } = route.params;
  const { client } = useAuth();
  const { logs, add } = useContext(ScanLogContext);
  useEffect(() => { navigation.setOptions({ title: event.name }); }, [navigation, event.name]);
  return (
    <EventScreen event={event} client={client} scanLog={logs[event.id] || []}
      onScanLogged={(entry) => add(event.id, entry)}
      onBack={() => navigation.goBack()}
      onRevoked={() => {}} />
  );
}
