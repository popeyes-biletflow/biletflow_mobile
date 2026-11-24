import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Button, Field, Notice } from "../components.js";
import { useAuth } from "../auth.js";
import { useI18n } from "../i18n.js";
import { checkoutErrorCode, maxQuantity, whyUnavailable } from "../models.js";
import { Muted, OptionCard, Row, Screen, Section } from "../ui.js";
import { colors } from "../theme.js";

const two = (n) => (n < 10 ? `0${n}` : String(n));

// biletflow_web CheckoutModal: select -> hold (15 min, server prices) -> demo payment -> order page.
export default function CheckoutScreen({ route, navigation }) {
  const { eventId, promo: initialPromo = "", tierId: initialTierId = "" } = route.params;
  const { client, user } = useAuth();
  const { t, formatDate, formatKZT } = useI18n();
  const [event, setEvent] = useState(null);
  const [step, setStep] = useState("select");
  const [tierId, setTierId] = useState("");
  const [qty, setQty] = useState(1);
  const [promo, setPromo] = useState(initialPromo.toUpperCase());
  const [attendees, setAttendees] = useState([{ name: user?.full_name || "", email: user?.email || "" }]);
  const [hold, setHold] = useState(null);
  const [outcome, setOutcome] = useState("approved");
  const [error, setError] = useState("");
  const [promoError, setPromoError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const holdRef = useRef(null);
  const done = useRef(false);

  const errText = (code) => t(`checkout.codes.${code}`, { defaultValue: t("checkout.codes.GENERIC") });

  useEffect(() => {
    client.getEvent(eventId).then((ev) => {
      setEvent(ev);
      // seat map pre-selects a tier (web initialTierId); fall back to the first purchasable one
      const wanted = ev.ticketTiers.find((x) => x.id === initialTierId && !whyUnavailable(x, ev));
      const first = ev.ticketTiers.find((x) => !whyUnavailable(x, ev));
      setTierId((wanted || first)?.id || "");
    }).catch((e) => setError(e.message));
  }, [client, eventId, initialTierId]);

  useEffect(() => {
    if (step !== "review") return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [step]);

  // leaving checkout releases the reservation at once (web: close/back)
  useEffect(() => navigation.addListener("beforeRemove", () => {
    if (holdRef.current && !done.current) client.releaseHold(holdRef.current.hold_id).catch(() => {});
  }), [navigation, client]);

  if (!event) return <Screen>{error ? <Notice tone="error">{error}</Notice> : <Muted>{t("common.loading")}</Muted>}</Screen>;

  const tiers = event.ticketTiers;
  const tier = tiers.find((x) => x.id === tierId);
  const maxQty = maxQuantity(tier);
  const secondsLeft = hold ? Math.max(0, Math.floor((Date.parse(hold.hold_expires_at) - now) / 1000)) : 0;
  const expired = step === "review" && hold !== null && secondsLeft === 0;

  function changeQty(n) {
    const q = Math.min(maxQty, Math.max(1, n));
    setQty(q);
    const list = attendees.slice(0, q);
    while (list.length < q) list.push({ name: "", email: "" });
    setAttendees(list);
  }

  function setAttendee(i, field, value) {
    const list = [...attendees];
    list[i] = { ...list[i], [field]: value };
    setAttendees(list);
  }

  function back() {
    if (holdRef.current) client.releaseHold(holdRef.current.hold_id).catch(() => {});
    holdRef.current = null;
    setHold(null);
    setError("");
    setStep("select");
  }

  async function reserve() {
    if (!tier) return;
    setBusy(true);
    setError("");
    setPromoError("");
    try {
      const h = await client.holdTickets(tier.id, qty, tier.priceKZT > 0 ? promo.trim() : undefined);
      holdRef.current = h;
      setHold(h);
      setOutcome("approved");
      setNow(Date.now());
      setStep("review");
    } catch (err) {
      const code = checkoutErrorCode(err);
      if (code.startsWith("PROMO_")) setPromoError(t(`checkout.codes.${code}`));
      else if (code === "NETWORK") setError(t("auth.errors.NETWORK"));
      else setError(errText(code));
    }
    setBusy(false);
  }

  async function pay() {
    if (!hold || busy) return; // busy blocks double taps; the server is idempotent per hold anyway
    setBusy(true);
    setError("");
    try {
      const list = attendees.map((a, i) => ({
        name: a.name.trim() || (i === 0 ? user?.full_name || "" : ""),
        email: a.email.trim() || (i === 0 ? user?.email || "" : "")
      }));
      const order = await client.confirmOrder(hold.hold_id, outcome, list);
      done.current = true;
      navigation.replace("Order", { orderId: order.order_id, isNew: true });
    } catch (err) {
      const code = checkoutErrorCode(err);
      setError(code === "NETWORK" ? t("auth.errors.NETWORK") : errText(code));
    }
    setBusy(false);
  }

  let payLabel = t("checkout.pay", { amount: hold ? formatKZT(hold.total_kzt) : "" });
  if (busy) payLabel = t("checkout.processing");
  else if (expired) payLabel = t("checkout.startAgain");
  else if (hold && hold.total_kzt === 0) payLabel = t("checkout.registerFree");

  return (
    <Screen keyboard>
      <View>
        <Text style={st.event}>{event.title}</Text>
        <Muted>{formatDate(event.startsAt, event.timezone, "full")} · {event.venueName}</Muted>
      </View>

      {step === "select" ? (
        <>
          {tiers.length === 0 ? <Notice tone="info">{t("checkout.noTiers")}</Notice> : null}
          <View style={st.gap8}>
            <Text style={st.label}>{t("checkout.ticketType")}</Text>
            {tiers.map((x) => {
              const why = whyUnavailable(x, event);
              return (
                <OptionCard key={x.id} selected={tierId === x.id} disabled={!!why}
                  onPress={() => { setTierId(x.id); changeQty(1); }}
                  title={x.name}
                  error={why ? t(`checkout.unavailable.${why}`) : null}
                  subtitle={!why && x.remaining !== null ? t("details.left", { count: x.remaining }) : null}
                  right={x.priceKZT > 0 ? formatKZT(x.priceKZT) : t("common.free")} />
              );
            })}
          </View>
          {tiers.some((x) => whyUnavailable(x, event) === "paidInactive") ? <Notice tone="warning">{t("checkout.paidBlockedNote")}</Notice> : null}

          {tier ? (
            <>
              <View style={st.qtyRow}>
                <Text style={st.qtyLabel}>{t("checkout.quantity")}</Text>
                <View style={st.qtyCtrl}>
                  <Button small variant="outline" label="−" disabled={qty <= 1} onPress={() => changeQty(qty - 1)} accessibilityLabel="−1" />
                  <TextInput value={String(qty)} keyboardType="number-pad" onChangeText={(v) => changeQty(Number(v) || 1)}
                    accessibilityLabel={t("checkout.quantity")} style={st.qtyInput} />
                  <Button small variant="outline" label="+" disabled={qty >= maxQty} onPress={() => changeQty(qty + 1)} accessibilityLabel="+1" />
                </View>
              </View>

              {tier.priceKZT > 0 ? (
                <View>
                  <Field label={t("checkout.promo")} value={promo} autoCapitalize="characters" autoCorrect={false}
                    onChangeText={(v) => { setPromo(v.toUpperCase()); setPromoError(""); }} />
                  {promoError ? <Text style={st.err}>{promoError}</Text> : <Muted small style={st.top4}>{promo && promo === initialPromo.toUpperCase() ? t("checkout.campaignPromo") : t("checkout.promoHint")}</Muted>}
                </View>
              ) : null}

              <View style={st.gap12}>
                <Text style={st.label}>{t("checkout.attendees")}</Text>
                {attendees.map((a, i) => (
                  <View key={i} style={st.gap8}>
                    <Field label={t("checkout.attendeeName", { n: i + 1 })} value={a.name} placeholder={i === 0 ? user?.full_name || "" : ""}
                      onChangeText={(v) => setAttendee(i, "name", v)} />
                    <Field label={t("checkout.attendeeEmail")} value={a.email} placeholder={i === 0 ? user?.email : ""} keyboardType="email-address"
                      autoCapitalize="none" autoCorrect={false} onChangeText={(v) => setAttendee(i, "email", v)} />
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {tiers.length > 0 && tiers.every((x) => whyUnavailable(x, event)) ? <Notice tone="info">{t("checkout.nothingAvailable")}</Notice> : null}
          {error ? <Notice tone="error" role="alert">{error}</Notice> : null}
          <Button label={busy ? t("checkout.processing") : t("checkout.reserve")} loading={busy}
            disabled={!tier || !!(tier && whyUnavailable(tier, event))} onPress={reserve} />
        </>
      ) : hold ? (
        <>
          <Notice tone={expired ? "error" : "info"}>
            {expired ? t("checkout.holdExpired") : t("checkout.holdTimer", { time: `${two(Math.floor(secondsLeft / 60))}:${two(secondsLeft % 60)}` })}
          </Notice>
          <Section title={t("checkout.reviewTitle")}>
            <Row label={`${tier?.name} × ${hold.quantity}`} value={formatKZT(hold.subtotal_kzt)} />
            {hold.discount_kzt > 0 ? (
              <Row tone="success" label={t("checkout.discountCode", { code: promo, percent: hold.discount_percent })} value={`−${formatKZT(hold.discount_kzt)}`} />
            ) : null}
            {hold.fee_kzt > 0 ? <Row label={t("checkout.fee")} value={formatKZT(hold.fee_kzt)} /> : null}
            <Row strong label={t("checkout.total")} value={formatKZT(hold.total_kzt)} />
          </Section>

          {hold.total_kzt > 0 ? (
            <Notice tone="warning" title={t("checkout.demoPayment")}>
              <Text style={st.demoNote}>{t("checkout.simulatedNote")}</Text>
              <View style={st.gap8}>
                <OptionCard tone="amber" selected={outcome === "approved"} onPress={() => setOutcome("approved")} title={t("checkout.outcome.approved")} />
                <OptionCard tone="amber" selected={outcome === "declined"} onPress={() => setOutcome("declined")} title={t("checkout.outcome.declined")} />
              </View>
            </Notice>
          ) : <Muted>{t("checkout.noPaymentNeeded")}</Muted>}

          {error ? <Notice tone="error" role="alert">{error}</Notice> : null}
          <View style={st.payRow}>
            <Button variant="outline" label={t("common.back")} disabled={busy} onPress={back} style={st.flex1} />
            <Button label={payLabel} loading={busy} onPress={expired ? back : pay} style={st.flex2} />
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const st = StyleSheet.create({
  event: { fontSize: 18, fontWeight: "700", color: colors.gray800 },
  label: { fontSize: 12, fontWeight: "600", color: colors.gray600 },
  gap8: { gap: 8 },
  gap12: { gap: 12 },
  top4: { marginTop: 4 },
  qtyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.gray100, borderRadius: 8, padding: 12 },
  qtyLabel: { fontSize: 14, fontWeight: "500", color: colors.gray800 },
  qtyCtrl: { flexDirection: "row", alignItems: "center", gap: 8 },
  qtyInput: { width: 54, textAlign: "center", borderWidth: 1, borderColor: colors.gray300, borderRadius: 6, paddingVertical: 8, backgroundColor: colors.white, color: colors.gray900, fontSize: 15 },
  err: { marginTop: 4, fontSize: 12, color: colors.red600 },
  demoNote: { fontSize: 12, color: colors.amber800, marginBottom: 8 },
  payRow: { flexDirection: "row", gap: 8 },
  flex1: { flex: 1 },
  flex2: { flex: 2 }
});
