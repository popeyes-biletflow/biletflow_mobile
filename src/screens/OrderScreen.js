import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Button, LinkButton, Notice } from "../components.js";
import { useAuth } from "../auth.js";
import { useI18n } from "../i18n.js";
import { H1, Muted, Row, Screen, Section } from "../ui.js";
import { colors } from "../theme.js";

// biletflow_web OrderPage: confirmation banner after checkout, breakdown, tickets.
export default function OrderScreen({ route, navigation }) {
  const { orderId, isNew } = route.params;
  const { client } = useAuth();
  const { t, formatDate, formatKZT } = useI18n();
  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useFocusEffect(useCallback(() => {
    client.getOrder(orderId)
      .then((o) => { setOrder(o); setStatus("ok"); })
      .catch((e) => { if (e.status === 404) setStatus("missing"); else { setError(e.message); setStatus("error"); } });
  }, [client, orderId]));

  if (status === "loading") return <Screen><Muted>{t("common.loading")}</Muted></Screen>;
  if (!order) {
    return (
      <Screen>
        <H1>{status === "missing" ? t("orderPage.notFound") : t("orders.loadError", { reason: error })}</H1>
        <LinkButton label={t("ticket.backToOrders")} onPress={() => navigation.navigate("Tabs", { screen: "TicketsTab" })} />
      </Screen>
    );
  }
  const free = order.breakdown_kzt.total === 0;

  return (
    <Screen>
      {isNew ? (
        <Notice tone="success" title={free ? t("checkout.freeConfirmed") : t("checkout.paidConfirmed")}>
          {t("orderPage.ticketsIssued", { count: order.tickets.length })}
        </Notice>
      ) : null}
      <View>
        <H1>{t("orders.order")} #{order.id.slice(0, 8)}</H1>
        {order.created_at ? <Muted>{formatDate(order.created_at, order.event.timezone, "full")}</Muted> : null}
      </View>

      <Section>
        <Text style={st.event} onPress={() => navigation.navigate("EventDetails", { eventId: order.event.id })}>{order.event.title}</Text>
        <Muted>{formatDate(order.event.starts_at, order.event.timezone, "full")}</Muted>
        <Muted>{order.event.venue_name} {order.event.venue_address}</Muted>
        <View style={st.top12}>
          <Row label={`${order.ticket_type.name} × ${order.quantity}`} value={formatKZT(order.breakdown_kzt.subtotal)} />
          {order.breakdown_kzt.discount > 0 ? <Row tone="success" label={t("orders.promo", { code: order.promo_code || "" })} value={`−${formatKZT(order.breakdown_kzt.discount)}`} /> : null}
          {order.breakdown_kzt.fee > 0 ? <Row label={t("checkout.fee")} value={formatKZT(order.breakdown_kzt.fee)} /> : null}
          <Row strong label={t("checkout.total")} value={formatKZT(order.breakdown_kzt.total)} />
        </View>
        <Muted small style={st.top8}>{free ? t("checkout.noPaymentNeeded") : t("orders.paidSimulated")}</Muted>
        <View style={st.top8}>
          <LinkButton label={t("support.helpOrder")} onPress={() => navigation.navigate("NewCase", {
            context: { order_id: order.id }, contextLabel: `${t("orders.order")} #${order.id.slice(0, 8)} · ${order.event.title}`, defaultCategory: "payment"
          })} />
        </View>
      </Section>

      <Text accessibilityRole="header" style={st.h2}>{t("orderPage.tickets")}</Text>
      {order.tickets.map((tk) => (
        <Section key={tk.id}>
          <Text selectable style={st.mono}>{tk.id}</Text>
          <Text style={st.attendee}>{tk.attendee_name || "—"}{tk.seat ? ` · ${tk.seat}` : ""}</Text>
          <Muted small>{t(`orders.status.${tk.status}`)}</Muted>
          {tk.qr_payload ? <View style={st.top8}><Button small label={t("orders.openTicket")} onPress={() => navigation.navigate("Ticket", { ticketId: tk.id })} /></View> : null}
        </Section>
      ))}
      <LinkButton label={t("ticket.backToOrders")} onPress={() => navigation.navigate("Tabs", { screen: "TicketsTab" })} />
    </Screen>
  );
}

const st = StyleSheet.create({
  event: { fontSize: 18, fontWeight: "700", color: colors.gray900 },
  h2: { fontSize: 18, fontWeight: "700", color: colors.gray900 },
  top12: { marginTop: 12 },
  top8: { marginTop: 8, alignItems: "flex-start" },
  mono: { fontSize: 12, color: colors.gray500, fontFamily: "monospace" },
  attendee: { fontSize: 15, fontWeight: "500", color: colors.gray900, marginTop: 2 }
});
