import { useCallback, useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { Button, LinkButton, Notice } from "../components.js";
import { useAuth } from "../auth.js";
import { useI18n } from "../i18n.js";
import { categoryKey } from "../models.js";
import { shareEventIcs } from "../files.js";
import HybridVenueMap from "../HybridVenueMap.js";
import { Body, H1, Muted, Screen, Section } from "../ui.js";
import { colors } from "../theme.js";

// biletflow_web EventDetailsPage (banners, tiers, HybridVenueMap, calendar) + EventPurchase (buy / login / ask organizer).
export default function EventDetailsScreen({ route, navigation }) {
  const { eventId } = route.params;
  const { client, user } = useAuth();
  const { t, formatDate, formatKZT } = useI18n();
  const [event, setEvent] = useState(null);
  const [state, setState] = useState("loading");
  const [attempt, setAttempt] = useState(0);
  const [fileError, setFileError] = useState("");
  const [now] = useState(() => Date.now());
  const retry = useCallback(() => { setState("loading"); setAttempt((n) => n + 1); }, []);

  // web useEvent: 404/403 = not found, anything else = load error with retry
  useEffect(() => {
    let active = true;
    client.getEvent(eventId)
      .then((e) => { if (active) { setEvent(e); setState("ok"); navigation.setOptions({ title: e.title }); } })
      .catch((e) => { if (active) setState(e?.status === 404 || e?.status === 403 ? "missing" : "error"); });
    return () => { active = false; };
  }, [client, eventId, navigation, user, attempt]);

  if (state === "loading") return <Screen><Muted>{t("details.loading")}</Muted></Screen>;
  if (state === "error" && !event) {
    return (
      <Screen>
        <Notice tone="error" role="alert">{t("details.loadError")}</Notice>
        <View style={st.actions}>
          <Button label={t("common.retry")} onPress={retry} />
          <LinkButton label={t("details.back")} onPress={() => navigation.goBack()} />
        </View>
      </Screen>
    );
  }
  if (!event) {
    return (
      <Screen>
        <H1>{t("details.notFound")}</H1>
        <LinkButton label={t("details.back")} onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  const full = (iso) => formatDate(iso, event.timezone, "full");
  const isPreview = event.status === "draft" || event.visibility !== "public";
  const canBuy = event.status === "published" && event.ticketTiers.length > 0;
  const regNotOpen = event.registrationOpensAt !== null && Date.parse(event.registrationOpensAt) > now;
  const regClosed = event.registrationClosesAt !== null && Date.parse(event.registrationClosesAt) < now;

  async function addToCalendar() {
    setFileError("");
    try { await shareEventIcs(event); } catch (e) { setFileError(t("files.shareFailed", { reason: e.message })); }
  }

  return (
    <Screen>
      {event.status === "cancelled" ? (
        <Notice tone="error" role="alert">{t("details.cancelledBanner")}</Notice>
      ) : isPreview ? (
        <Notice tone="warning">{t("details.previewBanner", { status: t(`eventStatus.${event.status}`), visibility: t(`visibility.${event.visibility}`) })}</Notice>
      ) : null}
      {event.status === "published" && (regNotOpen || regClosed) ? (
        <Notice tone="warning">
          {regNotOpen ? t("details.registrationNotOpen", { date: full(event.registrationOpensAt) }) : t("details.registrationClosed")}
        </Notice>
      ) : null}
      {event.imageUrl ? <Image source={{ uri: event.imageUrl }} style={st.image} resizeMode="cover" accessibilityIgnoresInvertColors /> : null}

      <View>
        <Text style={st.category}>{t(`categories.${categoryKey(event.category)}`, { defaultValue: event.category })}</Text>
        <H1>{event.title}</H1>
        {event.description ? <Body style={st.description}>{event.description}</Body> : null}
      </View>

      <Section title={t("details.when")}>
        <Body>{full(event.startsAt)}</Body>
        {event.endsAt ? <Muted>— {full(event.endsAt)}</Muted> : null}
        <Muted small style={st.gapTop}>{t("details.timezone", { tz: event.timezone })}</Muted>
      </Section>
      <Section title={t("details.venue")}>
        <Body>{event.venueName}</Body>
        {event.venueAddress ? <Muted>{event.venueAddress}</Muted> : null}
      </Section>

      <Section title={t("details.tickets")}>
        {event.ticketTiers.length === 0 ? <Muted>{t("details.noTiers")}</Muted> : null}
        {event.ticketTiers.map((tier, i) => (
          <View key={tier.id} style={[st.tier, i > 0 && st.tierBorder]}>
            <View style={st.flex}>
              <Text style={st.tierName}>{tier.name}</Text>
              {tier.remaining !== null ? (
                <Text style={st.tierLeft}>{tier.remaining > 0 ? t("details.left", { count: tier.remaining }) : t("details.soldOut")}</Text>
              ) : null}
            </View>
            <View style={st.tierRight}>
              <Text style={st.tierPrice}>{tier.priceKZT > 0 ? formatKZT(tier.priceKZT) : t("common.free")}</Text>
              {tier.priceKZT > 0 && !event.paidSalesActive ? <Text style={st.tierWarn}>{t("details.paidNotOnSale")}</Text> : null}
              {tier.saleStartsAt && Date.parse(tier.saleStartsAt) > now ? (
                <Text style={st.tierLeft}>{t("ticketTypes.from", { date: full(tier.saleStartsAt) })}</Text>
              ) : null}
              {tier.saleEndsAt && Date.parse(tier.saleEndsAt) < now ? (
                <Text style={st.tierLeft}>{t("details.salesEnded")}</Text>
              ) : null}
            </View>
          </View>
        ))}
      </Section>

      {canBuy ? (
        user ? (
          <View style={st.actions}>
            <Button variant="success" label={t("nav.buy")} onPress={() => navigation.navigate("Checkout", { eventId: event.id })} />
            <LinkButton label={t("support.askOrganizer")}
              onPress={() => navigation.navigate("NewCase", { context: { event_id: event.id }, contextLabel: event.title, defaultCategory: "event_information" })} />
          </View>
        ) : (
          <Button variant="outline" label={t("nav.loginToBuy")}
            onPress={() => navigation.navigate("SignIn", { next: { screen: "EventDetails", params: { eventId: event.id } } })} />
        )
      ) : null}

      <HybridVenueMap event={event} />

      {fileError ? <Notice tone="error">{fileError}</Notice> : null}
      <Button label={t("details.addToCalendar")} onPress={addToCalendar} />
    </Screen>
  );
}

const st = StyleSheet.create({
  flex: { flex: 1 },
  image: { width: "100%", aspectRatio: 21 / 9, borderRadius: 12, backgroundColor: colors.gray100 },
  category: { fontSize: 12, fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase", color: colors.blue600, marginBottom: 2 },
  description: { marginTop: 10 },
  gapTop: { marginTop: 4 },
  tier: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 12 },
  tierBorder: { borderTopWidth: 1, borderTopColor: colors.gray100 },
  tierName: { fontSize: 15, color: colors.gray900 },
  tierLeft: { fontSize: 12, color: colors.gray500, marginTop: 2 },
  tierRight: { alignItems: "flex-end", maxWidth: "50%" },
  tierPrice: { fontSize: 15, fontWeight: "700", color: colors.gray900 },
  tierWarn: { fontSize: 12, color: colors.amber800, marginTop: 2 },
  actions: { gap: 12, alignItems: "stretch" }
});
