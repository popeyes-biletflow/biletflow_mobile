import { useMemo, useState } from "react";
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { Badge, Button, Card, Notice } from "../components.js";
import { useI18n } from "../i18n.js";
import { colors, shadow } from "../theme.js";

// Mirrors biletflow_web EventsPage: title, search, result count, card grid (image, category, title, date, venue).
export default function EventsScreen({ user, events, loading, refreshing, error, offline, onRefresh, onOpen }) {
  const { t, formatDate } = useI18n();
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return events;
    return events.filter((event) =>
      [event.name, event.venue, event.venueAddress, event.category].join(" ").toLowerCase().includes(needle));
  }, [events, query]);

  const hint = user.role === "organizer" ? t("events.hintOrganizer")
    : user.role === "event_admin" ? t("events.hintStaff") : t("events.hintAdmin");

  const header = (
    <View style={st.header}>
      <Text accessibilityRole="header" style={st.h2}>{t("events.title")}</Text>
      <Text style={st.hint}>{hint}</Text>
      {offline ? <Notice tone="warning" style={st.gap}>{t("events.offline")}</Notice> : null}
      {error ? (
        <Notice tone="error" role="alert" style={st.gap}>
          <Text style={st.errorText}>{error}</Text>
          <View style={st.retry}><Button small variant="outline" label={t("common.retry")} onPress={onRefresh} /></View>
        </Notice>
      ) : null}
      <SearchInput value={query} onChangeText={setQuery} placeholder={t("events.search")} />
      {!loading && events.length > 0 ? <Text style={st.count}>{t("events.results", { count: visible.length })}</Text> : null}
      {loading ? <Text style={st.count}>{t("common.loading")}</Text> : null}
    </View>
  );

  return (
    <FlatList
      data={loading ? [] : visible}
      keyExtractor={(event) => event.id}
      contentContainerStyle={st.list}
      ListHeaderComponent={header}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} colors={[colors.blue600]} tintColor={colors.blue600} />}
      ListEmptyComponent={loading ? null : events.length === 0 && !error ? (
        <Card style={st.empty}>
          <Text style={st.emptyTitle}>{t("events.empty")}</Text>
          <Text style={st.emptyHint}>{t("events.emptyHint")}</Text>
          <Button small variant="outline" label={t("events.refresh")} onPress={onRefresh} style={st.emptyButton} />
        </Card>
      ) : events.length > 0 ? <Text style={st.count}>{t("events.noMatch")}</Text> : null}
      renderItem={({ item }) => (
        <Pressable accessibilityRole="button" accessibilityLabel={`${item.name}. ${t("events.open")}`}
          onPress={() => onOpen(item)} style={({ pressed }) => [st.cardWrap, pressed && st.pressed]}>
          <Card>
            {item.imageUrl
              ? <Image source={{ uri: item.imageUrl }} style={st.image} resizeMode="cover" accessibilityIgnoresInvertColors />
              : <View style={st.placeholder}><Text style={st.placeholderText}>BiletFlow</Text></View>}
            <View style={st.body}>
              <View style={st.metaRow}>
                {item.category ? <Text style={st.category}>{item.category}</Text> : <View />}
                {item.access ? <Badge tone={item.access === "owner" ? "blue" : "neutral"} label={t(`access.${item.access}`)} /> : null}
              </View>
              <Text style={st.title}>{item.name}</Text>
              <Text style={st.meta}>{formatDate(item.startsAt, item.timezone)}</Text>
              {item.venue ? <Text style={st.meta}>{item.venue}</Text> : null}
              <Text style={st.cta}>{t("events.open")} →</Text>
            </View>
          </Card>
        </Pressable>
      )}
    />
  );
}

function SearchInput(props) {
  return (
    <TextInput {...props} accessibilityLabel={props.placeholder} placeholderTextColor={colors.gray400}
      autoCapitalize="none" autoCorrect={false} returnKeyType="search" clearButtonMode="while-editing" style={st.search} />
  );
}

const st = StyleSheet.create({
  list: { padding: 16, paddingBottom: 32, backgroundColor: colors.gray50, flexGrow: 1 },
  header: { marginBottom: 4 },
  h2: { fontSize: 30, fontWeight: "700", color: colors.gray900, marginBottom: 4 },
  hint: { fontSize: 14, color: colors.gray500, marginBottom: 16 },
  gap: { marginBottom: 16 },
  errorText: { color: colors.red700, fontSize: 14 },
  retry: { marginTop: 10, alignItems: "flex-start" },
  search: { borderWidth: 1, borderColor: colors.gray300, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, backgroundColor: colors.white, color: colors.gray900, marginBottom: 16 },
  count: { fontSize: 14, color: colors.gray500, marginBottom: 16 },
  cardWrap: { marginBottom: 20 },
  pressed: { opacity: 0.85 },
  image: { width: "100%", aspectRatio: 16 / 9, backgroundColor: colors.gray100 },
  placeholder: { width: "100%", aspectRatio: 16 / 9, backgroundColor: colors.blue50, alignItems: "center", justifyContent: "center" },
  placeholderText: { fontSize: 20, fontWeight: "700", color: colors.blue600 },
  body: { padding: 16 },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  category: { fontSize: 12, fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase", color: colors.blue600 },
  title: { marginTop: 4, fontSize: 18, fontWeight: "700", color: colors.gray900 },
  meta: { marginTop: 4, fontSize: 14, color: colors.gray600 },
  cta: { marginTop: 10, fontSize: 14, fontWeight: "600", color: colors.blue600 },
  empty: { padding: 20, alignItems: "center", ...shadow.sm },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.gray800, textAlign: "center" },
  emptyHint: { marginTop: 6, fontSize: 14, color: colors.gray500, textAlign: "center", lineHeight: 20 },
  emptyButton: { marginTop: 14 }
});
