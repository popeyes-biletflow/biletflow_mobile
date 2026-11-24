import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Card, Notice } from "../components.js";
import EventCarousel from "../EventCarousel.js";
import { useAuth } from "../auth.js";
import { useI18n } from "../i18n.js";
import { categoryKey } from "../models.js";
import { colors } from "../theme.js";

// biletflow_web EventsPage: featured carousel, title, search, category chips, result count, cards with "from" price.
export default function DiscoverScreen({ navigation }) {
  const { client } = useAuth();
  const { t, formatDate, formatKZT } = useI18n();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");

  const load = useCallback(async (quiet) => {
    if (quiet) setRefreshing(true);
    try {
      setEvents(await client.getEvents());
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [client]);

  useEffect(() => { load(false); }, [load]);

  const catLabel = useCallback((raw) => t(`categories.${categoryKey(raw)}`, { defaultValue: raw }), [t]);
  const categories = useMemo(() => [...new Set(events.map((e) => e.category))].sort(), [events]);
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return events
      .filter((e) => category === "all" || e.category === category)
      .filter((e) => !needle || [e.title, e.description, e.venueName, e.venueAddress, catLabel(e.category)].join(" ").toLowerCase().includes(needle))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }, [events, q, category, catLabel]);

  const header = (
    <View>
      {!loading && !error && events.length > 0 ? (
        <EventCarousel events={events} onOpen={(e) => navigation.navigate("EventDetails", { eventId: e.id })} />
      ) : null}
      <Text accessibilityRole="header" style={st.h2}>{t("discovery.title")}</Text>
      <TextInput value={q} onChangeText={setQ} placeholder={t("discovery.searchPlaceholder")} accessibilityLabel={t("discovery.searchLabel")}
        placeholderTextColor={colors.gray400} autoCorrect={false} returnKeyType="search" clearButtonMode="while-editing" style={st.search} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chips} accessibilityLabel={t("filters.label")}>
        {["all", ...categories].map((c) => {
          const active = category === c;
          return (
            <Pressable key={c} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => setCategory(c)}
              style={[st.chip, active ? st.chipActive : st.chipIdle]}>
              <Text style={[st.chipText, active && st.chipTextActive]}>{c === "all" ? t("filters.all") : catLabel(c)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {!loading && !error ? (
        <View style={st.countRow}>
          <Text style={st.count}>{t("discovery.results", { count: visible.length })}</Text>
          {(q || category !== "all") ? (
            <Pressable onPress={() => { setQ(""); setCategory("all"); }}><Text style={st.clear}>{t("discovery.clear")}</Text></Pressable>
          ) : null}
        </View>
      ) : null}
      {loading ? <Text style={st.count}>{t("discovery.loading")}</Text> : null}
      {error ? <Notice tone="error" style={st.gap}>{t("discovery.error")}</Notice> : null}
    </View>
  );

  return (
    <FlatList
      style={st.screen}
      contentContainerStyle={st.list}
      data={visible}
      keyExtractor={(e) => e.id}
      ListHeaderComponent={header}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[colors.blue600]} tintColor={colors.blue600} />}
      ListEmptyComponent={!loading && !error ? <Text style={st.count}>{t("discovery.empty")}</Text> : null}
      renderItem={({ item: e }) => {
        const minPrice = e.ticketTiers.length ? Math.min(...e.ticketTiers.map((x) => x.priceKZT)) : null;
        return (
          <Pressable accessibilityRole="link" onPress={() => navigation.navigate("EventDetails", { eventId: e.id })}
            style={({ pressed }) => [st.cardWrap, pressed && st.pressed]}>
            <Card>
              {e.imageUrl
                ? <Image source={{ uri: e.imageUrl }} style={st.image} resizeMode="cover" accessibilityIgnoresInvertColors />
                : <View style={st.placeholder}><Text style={st.placeholderText}>BiletFlow</Text></View>}
              <View style={st.body}>
                <Text style={st.category}>{catLabel(e.category)}</Text>
                <Text style={st.title}>{e.title}</Text>
                <Text style={st.meta}>{formatDate(e.startsAt, e.timezone, "card")}</Text>
                <Text style={st.meta}>{e.venueName}</Text>
                {minPrice !== null ? <Text style={st.price}>{t("discovery.from", { price: formatKZT(minPrice) })}</Text> : null}
              </View>
            </Card>
          </Pressable>
        );
      }}
    />
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.gray50 },
  list: { padding: 16, paddingBottom: 32 },
  h2: { fontSize: 30, fontWeight: "700", color: colors.gray900, marginBottom: 16 },
  search: { borderWidth: 1, borderColor: colors.gray300, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, backgroundColor: colors.white, color: colors.gray900, marginBottom: 16 },
  chips: { gap: 8, paddingBottom: 16 },
  chip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 6 },
  chipActive: { borderColor: colors.blue600, backgroundColor: colors.blue600 },
  chipIdle: { borderColor: colors.gray300, backgroundColor: colors.white },
  chipText: { fontSize: 14, fontWeight: "500", color: colors.gray700 },
  chipTextActive: { color: colors.white },
  countRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  count: { fontSize: 14, color: colors.gray500, marginBottom: 16 },
  clear: { fontSize: 14, color: colors.blue600, marginBottom: 16 },
  gap: { marginBottom: 16 },
  cardWrap: { marginBottom: 20 },
  pressed: { opacity: 0.85 },
  image: { width: "100%", aspectRatio: 16 / 9, backgroundColor: colors.gray100 },
  placeholder: { width: "100%", aspectRatio: 16 / 9, backgroundColor: colors.blue50, alignItems: "center", justifyContent: "center" },
  placeholderText: { fontSize: 20, fontWeight: "700", color: colors.blue600 },
  body: { padding: 16 },
  category: { fontSize: 12, fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase", color: colors.blue600 },
  title: { marginTop: 4, fontSize: 18, fontWeight: "700", color: colors.gray900 },
  meta: { marginTop: 4, fontSize: 14, color: colors.gray600 },
  price: { marginTop: 8, fontSize: 15, fontWeight: "600", color: colors.emerald700 }
});
