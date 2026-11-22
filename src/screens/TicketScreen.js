import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button, LinkButton, Notice } from "../components.js";
import { useAuth } from "../auth.js";
import { useI18n } from "../i18n.js";
import { INVALID_TICKET } from "../models.js";
import { shareTicketPdf } from "../files.js";
import { H1, Muted, QRCodeView, Screen } from "../ui.js";
import { colors } from "../theme.js";

// biletflow_web TicketView + TicketPDF: the same ticket id and signed QR as the A4 PDF.
export default function TicketScreen({ route, navigation }) {
  const { ticketId } = route.params;
  const { client } = useAuth();
  const { t, lang, formatDate } = useI18n();
  const [ticket, setTicket] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    client.getMyTicket(ticketId)
      .then((tk) => { setTicket(tk); setStatus("ok"); })
      .catch((e) => { if (e.status === 404) setStatus("missing"); else { setError(e.message); setStatus("error"); } });
  }, [client, ticketId]);

  async function download() {
    setDownloading(true);
    setError("");
    try { await shareTicketPdf(client, ticketId, lang); }
    catch (e) { setError(t("ticket.pdfFailed", { reason: e.message })); }
    setDownloading(false);
  }

  if (status === "loading") return <Screen><Muted>{t("common.loading")}</Muted></Screen>;
  if (!ticket) {
    return (
      <Screen>
        <H1>{status === "error" ? t("orders.loadError", { reason: error }) : t("ticket.notFound")}</H1>
        <LinkButton label={t("ticket.backToOrders")} onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  const invalid = INVALID_TICKET.includes(ticket.status);
  return (
    <Screen>
      <View style={st.toolbar}>
        <Button small label={downloading ? t("common.loading") : t("ticket.downloadPdf")} disabled={downloading} onPress={download} style={st.flex} />
        <Button small variant="outline" label={t("common.close")} onPress={() => navigation.goBack()} style={st.flex} />
      </View>
      {error ? <Notice tone="error" role="alert">{error}</Notice> : null}

      <View style={st.paper}>
        <View style={st.dashed}>
          {invalid ? <Text accessibilityRole="alert" style={st.invalid}>{t("ticket.invalidBanner", { status: t(`orders.status.${ticket.status}`) })}</Text> : null}
          <View style={st.brandRow}>
            <View>
              <Text style={st.brand}>BILETFLOW</Text>
              <Text style={st.eTicket}>{t("ticket.eTicket")}</Text>
            </View>
            <Text style={st.type}>{ticket.ticket_type}</Text>
          </View>

          <Text style={st.event}>{ticket.event_title}</Text>
          <Field label={t("ticket.dateTime")} value={formatDate(ticket.starts_at, ticket.timezone, "full")} />
          <Field label={t("ticket.venue")} value={ticket.venue_name} extra={ticket.venue_address} />
          <Field label={t("ticket.attendee")} value={ticket.attendee_name} />
          {ticket.seat ? <Field label={t("ticket.seat")} value={ticket.seat} /> : null}

          <View style={st.qr}>
            {ticket.qr_payload && !invalid ? (
              <QRCodeView value={ticket.qr_payload} size={240} accessibilityLabel={t("ticket.qrTitle", { id: ticket.id })} />
            ) : (
              <View style={st.noQr}><Text style={st.noQrText}>{t("ticket.invalid")}</Text></View>
            )}
          </View>

          <View style={st.footer}>
            <Text selectable style={st.mono}>{t("ticket.id")}: {ticket.id}</Text>
            <Text style={st.footerText}>{t("ticket.footer")}</Text>
          </View>
        </View>
      </View>
    </Screen>
  );
}

function Field({ label, value, extra }) {
  return (
    <View style={st.field}>
      <Text style={st.fieldLabel}>{label}</Text>
      <Text style={st.fieldValue}>{value}</Text>
      {extra ? <Text style={st.fieldExtra}>{extra}</Text> : null}
    </View>
  );
}

const st = StyleSheet.create({
  flex: { flex: 1 },
  toolbar: { flexDirection: "row", gap: 10, backgroundColor: "rgba(17,24,39,0.85)", padding: 10, borderRadius: 12 },
  paper: { backgroundColor: colors.white, borderRadius: 16, padding: 16, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  dashed: { borderWidth: 3, borderStyle: "dashed", borderColor: colors.gray300, padding: 18, gap: 12 },
  invalid: { borderWidth: 2, borderColor: colors.red600, borderRadius: 8, padding: 10, textAlign: "center", fontWeight: "700", textTransform: "uppercase", color: colors.red700 },
  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.gray200, paddingBottom: 14 },
  brand: { fontSize: 24, fontWeight: "800", color: colors.blue600 },
  eTicket: { fontSize: 12, color: colors.gray500 },
  type: { backgroundColor: colors.blue100, color: colors.blue700, fontWeight: "700", fontSize: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, overflow: "hidden" },
  event: { fontSize: 21, fontWeight: "700", color: colors.gray900 },
  field: { gap: 1 },
  fieldLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", color: colors.gray500 },
  fieldValue: { fontSize: 15, fontWeight: "500", color: colors.gray900 },
  fieldExtra: { fontSize: 14, color: colors.gray600 },
  qr: { alignItems: "center", paddingVertical: 8 },
  noQr: { width: 208, height: 208, borderWidth: 2, borderColor: colors.gray300, borderRadius: 4, alignItems: "center", justifyContent: "center", padding: 16 },
  noQrText: { fontSize: 14, color: colors.gray500, textAlign: "center" },
  footer: { borderTopWidth: 1, borderTopColor: colors.gray200, paddingTop: 12, gap: 4 },
  mono: { fontSize: 11, color: colors.gray500, fontFamily: "monospace" },
  footerText: { fontSize: 12, color: colors.gray500, lineHeight: 17 }
});
