import { useEffect, useState } from "react";
import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path, Rect, Text as SvgText } from "react-native-svg";
import { Button, LinkButton, Notice } from "../components.js";
import { useAuth } from "../auth.js";
import { useI18n } from "../i18n.js";
import { arcPath, categoryKey } from "../models.js";
import { mapLinks, shareEventIcs } from "../files.js";
import { Body, H1, Muted, Screen, Section } from "../ui.js";
import { colors } from "../theme.js";

const SEAT_COLORS = ["#2563eb", "#059669", "#d97706", "#db2777", "#7c3aed", "#0891b2"];

// biletflow_web EventDetailsPage + EventPurchase (buy / login / ask organizer).
export default function EventDetailsScreen({ route, navigation }) {
  const { eventId } = route.params;
  const { client, user } = useAuth();
  const { t, formatDate, formatKZT } = useI18n();
  const [event, setEvent] = useState(null);
  const [state, setState] = useState("loading");
  const [fileError, setFileError] = useState("");
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    client.getEvent(eventId)
      .then((e) => { if (active) { setEvent(e); setState("ok"); navigation.setOptions({ title: e.title }); } })
      .catch(() => { if (active) setState("missing"); });
    return () => { active = false; };
  }, [client, eventId, navigation, user]);

  if (state === "loading") return <Screen><Muted>{t("details.loading")}</Muted></Screen>;
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
  const links = mapLinks(event.venueName, event.venueAddress);

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

      <SeatingLayout tiers={event.ticketTiers} />

      {links ? (
        <Section title={t("map.title")}>
          <Muted>{[event.venueName, event.venueAddress].filter(Boolean).join(", ")}</Muted>
          <View style={st.mapLinks}>
            <LinkButton label={t("map.openGoogle")} onPress={() => Linking.openURL(links.google)} />
            <LinkButton label={t("map.openYandex")} onPress={() => Linking.openURL(links.yandex)} />
          </View>
        </Section>
      ) : null}

      {fileError ? <Notice tone="error">{fileError}</Notice> : null}
      <Button label={t("details.addToCalendar")} onPress={addToCalendar} />
    </Screen>
  );
}

// biletflow_web SeatingLayout: most expensive tier closest to the stage; tap a band to see its price.
function SeatingLayout({ tiers }) {
  const { t, formatKZT } = useI18n();
  const [active, setActive] = useState(null);
  const ordered = [...tiers].sort((a, b) => b.priceKZT - a.priceKZT);
  if (!ordered.length) return null;
  const cx = 200, cy = 40, inner = 60, band = Math.min(48, 200 / ordered.length);
  const height = cy + inner + band * ordered.length + 20;
  const selected = ordered.find((x) => x.id === active);

  return (
    <Section title={t("seating.title")}>
      <Svg viewBox={`0 0 400 ${height}`} width="100%" style={{ aspectRatio: 400 / height }} accessibilityLabel={t("seating.title")}>
        <Rect x={cx - 70} y={cy - 28} width={140} height={28} rx={6} fill="#111827" />
        <SvgText x={cx} y={cy - 9} textAnchor="middle" fill="#fff" fontSize="12" fontWeight="700" letterSpacing="2">{t("seating.stage")}</SvgText>
        {ordered.map((tier, i) => {
          const on = active === tier.id;
          return (
            <Path key={tier.id} d={arcPath(cx, cy, inner + i * band + 3, inner + (i + 1) * band, -70, 70)}
              fill={tier.remaining === 0 ? "#d1d5db" : SEAT_COLORS[i % SEAT_COLORS.length]}
              fillOpacity={active && !on ? 0.35 : 0.9} stroke={on ? "#111827" : "#fff"} strokeWidth={on ? 2.5 : 1.5}
              onPress={() => setActive(on ? null : tier.id)} />
          );
        })}
      </Svg>
      <Text accessibilityLiveRegion="polite" style={st.seatHint}>
        {selected ? t("seating.selected", { tier: selected.name, price: formatKZT(selected.priceKZT) }) : t("seating.hint")}
      </Text>
      <View style={st.legend} accessibilityLabel={t("seating.legend")}>
        {ordered.map((tier, i) => (
          <Pressable key={tier.id} onPress={() => setActive(active === tier.id ? null : tier.id)} style={st.legendItem}>
            <View style={[st.swatch, { backgroundColor: tier.remaining === 0 ? "#d1d5db" : SEAT_COLORS[i % SEAT_COLORS.length] }]} />
            <Text style={st.legendText}>{tier.name} · {formatKZT(tier.priceKZT)}{tier.remaining === 0 ? ` (${t("details.soldOut")})` : ""}</Text>
          </Pressable>
        ))}
      </View>
    </Section>
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
  actions: { gap: 12, alignItems: "stretch" },
  mapLinks: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 10 },
  seatHint: { marginTop: 8, fontSize: 14, fontWeight: "500", color: colors.gray800 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  swatch: { width: 12, height: 12, borderRadius: 2 },
  legendText: { fontSize: 13, color: colors.gray700 }
});
