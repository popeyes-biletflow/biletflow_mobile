import { useCallback, useState } from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Badge, Button, LinkButton, Notice } from "../components.js";
import { useAuth } from "../auth.js";
import { useI18n } from "../i18n.js";
import { TICKET_BADGE_TONE, TICKET_FILTERS, ticketMatches } from "../models.js";
import { shareTicketPdf } from "../files.js";
import { EmptyState, H1, Muted, Screen, Section, TextArea, UnderlineTabs } from "../ui.js";
import { colors } from "../theme.js";

export function TicketStatusBadge({ status }) {
  const { t } = useI18n();
  return <Badge tone={TICKET_BADGE_TONE[status] || "error"} label={t(`orders.status.${status}`)} />;
}

// biletflow_web TicketDashboard: orders from /api/me/orders, ticket filters, PDF, help, cancellation request.
export default function OrdersScreen({ navigation }) {
  const { client, user } = useAuth();
  const { t, lang, formatDate, formatKZT } = useI18n();
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [pdfBusy, setPdfBusy] = useState("");
  const [pdfError, setPdfError] = useState("");
  const [cancel, setCancel] = useState(null); // { ticket, order }
  const [reason, setReason] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState("");

  const load = useCallback(async (quiet) => {
    if (quiet) setRefreshing(true);
    try {
      setOrders(await client.getOrders());
      setLoadError("");
    } catch (e) {
      setLoadError(e.code === "NETWORK" ? t("auth.errors.NETWORK") : e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [client, t]);

  useFocusEffect(useCallback(() => { load(false); }, [load]));

  async function downloadPdf(ticketId) {
    setPdfBusy(ticketId);
    setPdfError("");
    try { await shareTicketPdf(client, ticketId, lang); }
    catch (e) { setPdfError(t("ticket.pdfFailed", { reason: e.message })); }
    setPdfBusy("");
  }

  async function sendCancel() {
    if (!cancel) return;
    setSending(true);
    setCancelError("");
    try {
      await client.requestCancel(cancel.ticket.id, t("orders.cancelSubject", { event: cancel.order.event.title }),
        reason.trim() || t("orders.cancelDefaultReason"));
      setSuccess(t("orders.cancelSent"));
      setTimeout(() => setSuccess(""), 4000);
      setCancel(null);
      setReason("");
      load(true);
    } catch (e) {
      setCancelError(e.message);
    }
    setSending(false);
  }

  const ticketCount = orders.reduce((n, o) => n + o.tickets.length, 0);
  const visible = orders
    .map((o) => ({ ...o, tickets: o.tickets.filter((tk) => ticketMatches(tk.status, filter)) }))
    .filter((o) => o.tickets.length > 0);

  return (
    <Screen refreshing={refreshing} onRefresh={() => load(true)}>
      <View>
        <H1>{t("orders.title")}</H1>
        <Muted>{user?.full_name || user?.email} · {t("orders.summary", { orders: orders.length, count: ticketCount })}</Muted>
      </View>
      {success ? <Notice tone="success">{success}</Notice> : null}
      {pdfError ? <Notice tone="error" role="alert">{pdfError}</Notice> : null}

      <UnderlineTabs value={filter} onChange={setFilter} tabs={TICKET_FILTERS.map((f) => ({ value: f, label: t(`orders.filter.${f}`) }))} />

      {loading ? <Muted>{t("common.loading")}</Muted> : null}
      {!loading && loadError ? (
        <Notice tone="error">
          <Text style={st.errText}>{t("orders.loadError", { reason: loadError })}</Text>
          <View style={st.top8}><Button small variant="outline" label={t("common.retry")} onPress={() => load(true)} /></View>
        </Notice>
      ) : null}
      {!loading && !loadError && visible.length === 0 ? (
        <EmptyState action={orders.length === 0 ? <LinkButton label={t("orders.toEvents")} onPress={() => navigation.navigate("EventsTab")} /> : null}>
          {orders.length === 0 ? t("orders.empty") : t("orders.emptyFilter")}
        </EmptyState>
      ) : null}

      {visible.map((o) => (
        <Section key={o.id}>
          <View style={st.head}>
            <View style={st.flex}>
              <Text style={st.event} onPress={() => navigation.navigate("EventDetails", { eventId: o.event.id })}>{o.event.title}</Text>
              <Muted>{formatDate(o.event.starts_at, o.event.timezone, "full")} · {o.event.venue_name}</Muted>
              <Text style={st.orderLink} onPress={() => navigation.navigate("Order", { orderId: o.id })}>{t("orders.order")} #{o.id.slice(0, 8)}</Text>
            </View>
            <View style={st.right}>
              <Text style={st.total}>{o.breakdown_kzt.total > 0 ? formatKZT(o.breakdown_kzt.total) : t("common.free")}</Text>
              <Muted small>{o.ticket_type.name} × {o.quantity}</Muted>
              {o.breakdown_kzt.discount > 0 ? <Text style={st.discount}>{t("orders.promo", { code: o.promo_code || "" })} −{formatKZT(o.breakdown_kzt.discount)}</Text> : null}
              <Muted small>{o.breakdown_kzt.total > 0 ? t("orders.paidSimulated") : t("orders.freeConfirmed")}</Muted>
            </View>
          </View>

          {o.tickets.map((tk) => (
            <View key={tk.id} style={st.ticket}>
              <View style={st.ticketTop}>
                <TicketStatusBadge status={tk.status} />
                <Text style={st.mono}>#{tk.id.slice(0, 8)}</Text>
              </View>
              <Text style={st.attendee}>{tk.attendee_name || user?.full_name}{tk.seat ? <Text style={st.mutedInline}> · {tk.seat}</Text> : null}</Text>
              {tk.status === "REFUNDED" ? <Text style={st.purple}>{t("orders.refundedNote")}</Text> : null}
              {tk.status === "CANCELLED" ? <Text style={st.red}>{t("orders.cancelledNote")}</Text> : null}
              {tk.status === "USED" && tk.checked_in_at ? <Muted small>{t("orders.checkedInAt", { date: formatDate(tk.checked_in_at, o.event.timezone, "full") })}</Muted> : null}
              <View style={st.actions}>
                <Button small label={t("orders.viewTicket")} onPress={() => navigation.navigate("Ticket", { ticketId: tk.id })} />
                <Button small variant="outline" label={pdfBusy === tk.id ? t("common.loading") : t("ticket.downloadPdf")}
                  disabled={pdfBusy === tk.id} onPress={() => downloadPdf(tk.id)} />
                <Button small variant="outline" label={t("support.helpShort")}
                  onPress={() => navigation.navigate("NewCase", { context: { ticket_id: tk.id }, contextLabel: `${o.event.title} · #${tk.id.slice(0, 8)}`, defaultCategory: "ticket_delivery" })} />
                {tk.status === "ACTIVE" ? (
                  <Button small variant="danger" label={t("orders.requestCancel")} onPress={() => { setCancelError(""); setCancel({ ticket: tk, order: o }); }} />
                ) : null}
              </View>
            </View>
          ))}
        </Section>
      ))}

      <Modal transparent animationType="fade" visible={!!cancel} onRequestClose={() => setCancel(null)}>
        <View style={st.backdrop}>
          {cancel ? (
            <View style={st.dialog}>
              <Text style={st.dialogTitle}>{t("orders.cancelTitle", { id: cancel.ticket.id.slice(0, 8) })}</Text>
              <Muted small>{t("orders.cancelHint", { event: cancel.order.event.title })}</Muted>
              <TextArea label={t("orders.cancelReason")} value={reason} onChangeText={setReason} rows={3} />
              {cancelError ? <Text style={st.red}>{cancelError}</Text> : null}
              <View style={st.dialogActions}>
                <Button small variant="outline" label={t("common.back")} onPress={() => setCancel(null)} style={st.flex} />
                <Button small variant="danger" label={sending ? t("common.loading") : t("orders.sendCancel")} disabled={sending} onPress={sendCancel} style={st.flex} />
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
    </Screen>
  );
}

const st = StyleSheet.create({
  flex: { flex: 1 },
  top8: { marginTop: 8, alignItems: "flex-start" },
  errText: { color: colors.red700, fontSize: 14 },
  head: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  event: { fontSize: 19, fontWeight: "700", color: colors.gray900 },
  orderLink: { marginTop: 4, fontSize: 12, color: colors.gray500, fontFamily: "monospace" },
  right: { alignItems: "flex-end" },
  total: { fontSize: 18, fontWeight: "900", color: colors.gray900 },
  discount: { fontSize: 12, color: colors.emerald700 },
  ticket: { borderTopWidth: 1, borderTopColor: colors.gray100, marginTop: 12, paddingTop: 12, gap: 4 },
  ticketTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  mono: { fontSize: 12, color: colors.gray400, fontFamily: "monospace" },
  attendee: { fontSize: 14, color: colors.gray900, marginTop: 2 },
  mutedInline: { color: colors.gray500 },
  purple: { fontSize: 12, color: "#6b21a8" },
  red: { fontSize: 12, color: colors.red700 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  backdrop: { flex: 1, backgroundColor: "rgba(17,24,39,0.5)", justifyContent: "center", padding: 20 },
  dialog: { backgroundColor: colors.white, borderRadius: 12, padding: 20, gap: 12 },
  dialogTitle: { fontSize: 18, fontWeight: "700", color: colors.gray900 },
  dialogActions: { flexDirection: "row", gap: 10, marginTop: 4 }
});
