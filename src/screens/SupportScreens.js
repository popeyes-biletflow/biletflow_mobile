import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Badge, Button, Field, LinkButton, Notice } from "../components.js";
import { useAuth } from "../auth.js";
import { useI18n } from "../i18n.js";
import { useNotifications } from "../notifications.js";
import {
  ORGANIZER_PLATFORM_CATEGORIES, SUPPORT_CATEGORIES, SUPPORT_STATUSES, SUPPORT_STATUS_TONE, notificationTarget
} from "../models.js";
import { EmptyState, H1, Muted, Screen, Section, SelectField, TextArea } from "../ui.js";
import { colors } from "../theme.js";

// ---------------- SupportPage ----------------
export function SupportListScreen({ navigation }) {
  const { client, user, isOrganizer } = useAuth();
  const { t, formatStamp } = useI18n();
  const { unreadCaseIds } = useNotifications();
  const [cases, setCases] = useState([]);
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (quiet) => {
    if (quiet) setRefreshing(true);
    try { setCases(await client.listCases({ status, category })); setError(""); }
    catch (e) { setError(e.code === "NETWORK" ? t("auth.errors.NETWORK") : e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, [client, status, category, t]);

  useFocusEffect(useCallback(() => {
    load(false);
    const timer = setInterval(() => load(false), 30000); // web: refresh every 30 s, no sockets
    return () => clearInterval(timer);
  }, [load]));

  const all = { value: "", label: t("support.all") };
  return (
    <Screen refreshing={refreshing} onRefresh={() => load(true)}>
      <View style={st.headRow}>
        <H1 style={st.flex}>{t("support.title")}</H1>
        <Button small label={isOrganizer ? t("support.contactPlatform") : t("support.newCase")}
          onPress={() => navigation.navigate("NewCase", { platform: isOrganizer })} />
      </View>
      <Muted>{isOrganizer ? t("support.organizerHint") : t("support.attendeeHint")}</Muted>

      <Section>
        <View style={st.filters}>
          <View style={st.flex}>
            <SelectField label={t("support.status")} value={status} onChange={setStatus}
              options={[all, ...SUPPORT_STATUSES.map((s) => ({ value: s, label: t(`support.statuses.${s}`) }))]} />
          </View>
          <View style={st.flex}>
            <SelectField label={t("support.category")} value={category} onChange={setCategory}
              options={[all, ...SUPPORT_CATEGORIES.map((c) => ({ value: c, label: t(`support.categories.${c}`) }))]} />
          </View>
        </View>
      </Section>

      {error ? <Notice tone="error" role="alert">{error}</Notice> : null}
      {loading ? <Muted>{t("common.loading")}</Muted> : null}
      {!loading && !error && cases.length === 0 ? <EmptyState>{t("support.empty")}</EmptyState> : null}

      {cases.map((c) => (
        <Pressable key={c.id} accessibilityRole="link" onPress={() => navigation.navigate("SupportCase", { caseId: c.id })}
          style={({ pressed }) => [st.caseCard, pressed && st.pressed]}>
          <View style={st.flex}>
            <View style={st.subjectRow}>
              {unreadCaseIds.has(c.id) ? <View style={st.dot} accessibilityLabel={t("support.unread")} /> : null}
              <Text style={st.subject}>{c.subject}</Text>
            </View>
            <Muted small>
              {t(`support.categories.${c.category}`)} · {formatStamp(c.updated_at || c.created_at)}
              {c.requester_id === user?.id ? ` · ${t("support.mine")}` : ""}
            </Muted>
          </View>
          <Badge tone={SUPPORT_STATUS_TONE[c.status]} label={t(`support.statuses.${c.status}`)} />
        </Pressable>
      ))}
    </Screen>
  );
}

// ---------------- SupportDialog (as a screen) ----------------
export function NewCaseScreen({ route, navigation }) {
  const { context = {}, contextLabel, defaultCategory, platform } = route.params || {};
  const { client } = useAuth();
  const { t } = useI18n();
  const categories = platform ? ORGANIZER_PLATFORM_CATEGORIES : SUPPORT_CATEGORIES;
  const [category, setCategory] = useState(defaultCategory || categories[0]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: platform ? t("support.platformTitle") : t("support.newTitle") });
  }, [navigation, platform, t]);

  async function submit() {
    if (!subject.trim() || !message.trim()) { setError(t("support.fillAll")); return; }
    setBusy(true);
    setError("");
    try {
      const res = await client.createCase({ category, subject: subject.trim(), message: message.trim(), ...context });
      navigation.replace("SupportCase", { caseId: res.case.id });
    } catch (e) {
      setError(t("support.createFailed", { reason: e.message }));
    }
    setBusy(false);
  }

  return (
    <Screen keyboard>
      {contextLabel ? <Notice tone="info">{t("support.about", { what: contextLabel })}</Notice> : null}
      {error ? <Notice tone="error" role="alert">{error}</Notice> : null}
      <SelectField label={t("support.category")} value={category} onChange={setCategory}
        options={categories.map((c) => ({ value: c, label: t(`support.categories.${c}`) }))} />
      <Field label={t("support.subject")} value={subject} onChangeText={setSubject} maxLength={200} />
      <TextArea label={t("support.message")} value={message} onChangeText={setMessage} rows={6} maxLength={5000} />
      <View style={st.btnRow}>
        <Button variant="outline" label={t("common.cancel")} onPress={() => navigation.goBack()} style={st.flex} />
        <Button label={busy ? t("common.loading") : t("support.send")} loading={busy} onPress={submit} style={st.flex} />
      </View>
    </Screen>
  );
}

// ---------------- SupportCasePage ----------------
export function SupportCaseScreen({ route, navigation }) {
  const { caseId } = route.params;
  const { client, user } = useAuth();
  const { t, formatStamp } = useI18n();
  const { markCaseRead, unreadCaseIds } = useNotifications();
  const [c, setCase] = useState(null);
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [info, setInfo] = useState("");
  const [showEscalate, setShowEscalate] = useState(false);
  const [escalateNote, setEscalateNote] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await client.getCase(caseId);
      setCase(res.case);
      setMessages(res.messages || []);
      setStatus("ok");
      setError("");
      navigation.setOptions({ title: res.case.subject });
    } catch (e) {
      if (e.status === 404 || e.status === 403) setStatus("missing");
      else setError(e.message);
    }
  }, [client, caseId, navigation]);

  useFocusEffect(useCallback(() => {
    load();
    const timer = setInterval(load, 15000); // web: new messages every 15 s
    return () => clearInterval(timer);
  }, [load]));

  useEffect(() => { if (unreadCaseIds.has(caseId)) markCaseRead(caseId); }, [unreadCaseIds, caseId, markCaseRead]);

  if (status === "loading" && !error) return <Screen><Muted>{t("common.loading")}</Muted></Screen>;
  if (!c) {
    return (
      <Screen>
        <H1>{status === "missing" ? t("support.notFound") : error}</H1>
        <LinkButton label={t("support.back")} onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  const isRequester = c.requester_id === user?.id;
  const isStaff = user?.role === "platform_admin" || (user?.role === "organizer" && !isRequester);
  const canEscalate = user?.role === "organizer" && !isRequester && c.status !== "RESOLVED";
  const whoSent = (id) => (id === user?.id ? t("support.you") : id === c.requester_id ? t("support.requester") : t("support.staff"));

  async function send() {
    if (!reply.trim()) return;
    setSending(true);
    try { await client.replyCase(c.id, reply.trim()); setReply(""); await load(); }
    catch (e) { setError(e.message); }
    setSending(false);
  }

  async function changeStatus(next, assign) {
    try {
      await client.setCaseStatus(c.id, next, assign);
      setInfo(assign ? t("support.assigned") : t("support.statusChanged"));
      await load();
    } catch (e) { setError(e.message); }
  }

  async function escalate() {
    try {
      const res = await client.escalateCase(c.id, escalateNote);
      setShowEscalate(false);
      setEscalateNote("");
      setInfo(t("support.escalated", { id: res.escalation_case.id.slice(0, 8) }));
      await load();
    } catch (e) { setError(e.message); }
  }

  return (
    <Screen keyboard>
      <View>
        <View style={st.headRow}>
          <H1 style={st.flex}>{c.subject}</H1>
          <Badge tone={SUPPORT_STATUS_TONE[c.status]} label={t(`support.statuses.${c.status}`)} />
        </View>
        <Muted>{t(`support.categories.${c.category}`)} · {formatStamp(c.created_at)}</Muted>
        <View style={st.ctx}>
          {c.event_id ? <LinkButton label={t("support.ctxEvent")} onPress={() => navigation.navigate("EventDetails", { eventId: c.event_id })} /> : null}
          {c.order_id && isRequester ? <LinkButton label={t("support.ctxOrder")} onPress={() => navigation.navigate("Order", { orderId: c.order_id })} /> : null}
          {c.ticket_id && isRequester ? <LinkButton label={t("support.ctxTicket")} onPress={() => navigation.navigate("Ticket", { ticketId: c.ticket_id })} /> : null}
          {c.ticket_id && !isRequester ? <Muted small>{t("support.ctxTicket")}: {c.ticket_id.slice(0, 8)}</Muted> : null}
        </View>
      </View>

      {info ? <Notice tone="success" onClose={() => setInfo("")}>{info}</Notice> : null}
      {error ? <Notice tone="error" role="alert" onClose={() => setError("")}>{error}</Notice> : null}

      {isStaff ? (
        <Section title={t("support.staffTools")}>
          <SelectField label={t("support.status")} value={c.status} onChange={(s) => changeStatus(s, false)}
            options={SUPPORT_STATUSES.map((s) => ({ value: s, label: t(`support.statuses.${s}`) }))} />
          <View style={st.btnRowWrap}>
            <Button small variant="outline" disabled={c.assigned_to === user?.id}
              label={c.assigned_to === user?.id ? t("support.assignedToYou") : t("support.assignToMe")}
              onPress={() => changeStatus(c.status === "OPEN" ? "IN_PROGRESS" : c.status, true)} />
            {canEscalate ? <Button small variant="outline" label={t("support.escalate")} onPress={() => setShowEscalate(!showEscalate)} /> : null}
          </View>
        </Section>
      ) : null}

      {showEscalate ? (
        <Notice tone="warning">
          <TextArea label={t("support.escalateNote")} value={escalateNote} onChangeText={setEscalateNote} rows={3} />
          <View style={st.top8}><Button small label={t("support.escalateSend")} onPress={escalate} /></View>
        </Notice>
      ) : null}

      <View style={st.thread} accessibilityLabel={t("support.thread")}>
        {messages.map((m) => {
          const mine = m.sender_id === user?.id;
          return (
            <View key={m.id} style={[st.msgRow, mine ? st.msgMine : st.msgOther]}>
              <View style={[st.bubble, mine ? st.bubbleMine : st.bubbleOther]}>
                <Text style={[st.msgMeta, mine && st.msgMetaMine]}>{whoSent(m.sender_id)} · {formatStamp(m.created_at)}</Text>
                <Text style={[st.msgBody, mine && st.msgBodyMine]}>{m.body}</Text>
              </View>
            </View>
          );
        })}
      </View>

      {c.status === "RESOLVED" ? (
        <Notice tone="info">{t("support.resolvedNote")}</Notice>
      ) : (
        <View style={st.gap8}>
          <TextArea label={t("support.reply")} value={reply} onChangeText={setReply} rows={3} maxLength={5000} />
          <View style={st.replyRow}>
            <Muted small style={st.flex}>{t("support.pollHint")}</Muted>
            <Button small label={sending ? t("common.loading") : t("support.send")} disabled={sending || !reply.trim()} onPress={send} />
          </View>
        </View>
      )}
    </Screen>
  );
}

// ---------------- NotificationBell list ----------------
export function NotificationsScreen({ navigation }) {
  const { t, formatStamp } = useI18n();
  const { items, markRead, reload } = useNotifications();
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  return (
    <Screen onRefresh={reload}>
      {items.length === 0 ? <EmptyState>{t("notifications.empty")}</EmptyState> : null}
      {items.slice(0, 50).map((n) => (
        <Pressable key={n.id} accessibilityRole="link" style={({ pressed }) => [st.note, !n.read && st.noteUnread, pressed && st.pressed]}
          onPress={() => { markRead(n.id); const target = notificationTarget(n); navigation.navigate(target.screen, target.params); }}>
          <Text style={n.read ? st.noteTitle : st.noteTitleUnread}>{n.title}</Text>
          <Text style={st.noteMsg} numberOfLines={2}>{n.message}</Text>
          <Text style={st.noteTime}>{formatStamp(n.created_at)}</Text>
        </Pressable>
      ))}
      <LinkButton label={t("notifications.allCases")} onPress={() => navigation.navigate("Tabs", { screen: "SupportTab" })} />
    </Screen>
  );
}

const st = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  headRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  filters: { flexDirection: "row", gap: 12 },
  caseCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gray200, borderRadius: 12, padding: 14 },
  subjectRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.blue600 },
  subject: { fontSize: 15, fontWeight: "600", color: colors.gray900, flexShrink: 1 },
  btnRow: { flexDirection: "row", gap: 10 },
  btnRowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  ctx: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 6 },
  top8: { marginTop: 8, alignItems: "flex-start" },
  gap8: { gap: 8 },
  thread: { gap: 10 },
  msgRow: { flexDirection: "row" },
  msgMine: { justifyContent: "flex-end" },
  msgOther: { justifyContent: "flex-start" },
  bubble: { maxWidth: "85%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 },
  bubbleMine: { backgroundColor: colors.blue600 },
  bubbleOther: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gray200 },
  msgMeta: { fontSize: 11, color: colors.gray500, marginBottom: 2 },
  msgMetaMine: { color: colors.blue100 },
  msgBody: { fontSize: 14, lineHeight: 20, color: colors.gray900 },
  msgBodyMine: { color: colors.white },
  replyRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  note: { backgroundColor: colors.white, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: colors.gray100 },
  noteUnread: { borderColor: colors.blue100, backgroundColor: colors.blue50 },
  noteTitle: { fontSize: 14, color: colors.gray600 },
  noteTitleUnread: { fontSize: 14, fontWeight: "700", color: colors.gray900 },
  noteMsg: { fontSize: 13, color: colors.gray500, marginTop: 2 },
  noteTime: { fontSize: 11, color: colors.gray400, marginTop: 4 }
});
