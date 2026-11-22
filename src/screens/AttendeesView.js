import { FlatList, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { Badge, Button, Card } from "../components.js";
import { useI18n } from "../i18n.js";
import { colors } from "../theme.js";

// FS-23: roster search by name, email or ticket ID with paging and permission-aware actions.
export default function AttendeesView({
  search, onSearch, rows, loading, error, page, hasPrev, hasNext, onPrev, onNext, onRefresh,
  canUndo, writesAllowed, pendingTicket, onCheckIn, onUndo
}) {
  const { t } = useI18n();
  return (
    <FlatList
      data={rows}
      keyExtractor={(item) => item.ticketId}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={st.list}
      refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} colors={[colors.blue600]} tintColor={colors.blue600} />}
      ListHeaderComponent={
        <TextInput value={search} onChangeText={onSearch} placeholder={t("attendees.search")}
          accessibilityLabel={t("attendees.search")} placeholderTextColor={colors.gray400}
          autoCapitalize="none" autoCorrect={false} returnKeyType="search" clearButtonMode="while-editing" style={st.search} />
      }
      ListEmptyComponent={
        <Text style={st.muted}>{loading ? t("common.loading") : error ? t("attendees.unavailable") : t("attendees.empty")}</Text>
      }
      ListFooterComponent={(hasPrev || hasNext) ? (
        <View style={st.pager}>
          <Button small variant="outline" label={t("attendees.prev")} disabled={!hasPrev || loading} onPress={onPrev} />
          <Text style={st.muted}>{t("attendees.page", { page })}</Text>
          <Button small variant="outline" label={t("attendees.next")} disabled={!hasNext || loading} onPress={onNext} />
        </View>
      ) : null}
      renderItem={({ item }) => {
        const pending = pendingTicket === item.ticketId;
        return (
          <Card style={st.card}>
            <View style={st.row}>
              <Text style={st.name} numberOfLines={1}>{item.name}</Text>
              <Badge tone={item.checkedIn ? "success" : "neutral"} label={item.checkedIn ? t("attendees.checkedIn") : t("attendees.notCheckedIn")} />
            </View>
            {item.email ? <Text style={st.meta}>{item.email}</Text> : null}
            <Text selectable style={st.mono}>{t("attendees.ticket")}: {item.ticketId}</Text>
            {!item.checkedIn ? (
              <Button small variant="success" style={st.action} label={pending ? t("attendees.saving") : t("attendees.checkIn")}
                loading={pending} disabled={!writesAllowed || (pendingTicket && !pending)} onPress={() => onCheckIn(item)} />
            ) : canUndo ? (
              <Button small variant="danger" style={st.action} label={pending ? t("attendees.saving") : t("attendees.undo")}
                loading={pending} disabled={!writesAllowed || (pendingTicket && !pending)} onPress={() => onUndo(item)} />
            ) : null}
          </Card>
        );
      }}
    />
  );
}

const st = StyleSheet.create({
  list: { padding: 16, paddingBottom: 32, flexGrow: 1 },
  search: { borderWidth: 1, borderColor: colors.gray300, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, backgroundColor: colors.white, color: colors.gray900, marginBottom: 16 },
  muted: { fontSize: 14, color: colors.gray500, textAlign: "center" },
  card: { padding: 16, marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  name: { flex: 1, fontSize: 17, fontWeight: "700", color: colors.gray900 },
  meta: { marginTop: 4, fontSize: 14, color: colors.gray600 },
  mono: { marginTop: 4, fontSize: 12, color: colors.gray500 },
  action: { marginTop: 12, alignSelf: "flex-start" },
  pager: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }
});
