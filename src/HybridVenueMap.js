// biletflow_web HybridVenueMap: seating plan (tier colours, occupied / selected seats, zoom, booking
// summary), location and tiers & pricing tabs. Touch adaptations: a tap inspects any seat (the web shows
// this on hover) and toggles an available one; the plan keeps the web's 560-unit minimum width and
// scrolls sideways; the location tab opens Google / Yandex Maps instead of embedding an iframe.
import { useMemo, useRef, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, G, LinearGradient, Path, Rect, Stop, Text as SvgText } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "./auth.js";
import { useI18n } from "./i18n.js";
import { mapLinks } from "./files.js";
import { SEAT_PLAN, buildSeatPlan, orderTiersByPrice, tierColorMap, tierRowsKey } from "./models.js";
import { colors, shadow } from "./theme.js";

const DEFAULT_COLORS = { fill: "#3b82f6", border: "#2563eb" };
const ZOOM_MIN = 0.85;
const ZOOM_MAX = 1.4;

export default function HybridVenueMap({ event }) {
  const { t } = useI18n();
  const [tab, setTab] = useState("seating");
  const tabs = [
    { value: "seating", label: t("hybridMap.tabSeating") },
    { value: "location", label: t("hybridMap.tabLocation") },
    { value: "sectors", label: t("hybridMap.tabSectors") }
  ];

  return (
    <View style={st.root}>
      <View style={st.header}>
        <Text accessibilityRole="header" style={st.title}>{t("hybridMap.title")}</Text>
        <Text style={st.subtitle}>{t("hybridMap.subtitle")}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" contentContainerStyle={st.tabs}>
          {tabs.map((x) => {
            const active = x.value === tab;
            return (
              <Pressable key={x.value} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => setTab(x.value)}
                style={[st.tab, active ? st.tabActive : st.tabIdle]}>
                <Text style={[st.tabText, active && st.tabTextActive]}>{x.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {tab === "seating" ? <SeatingTab event={event} /> : null}
      {tab === "location" ? <LocationTab event={event} /> : null}
      {tab === "sectors" ? <SectorsTab event={event} /> : null}
    </View>
  );
}

function SeatingTab({ event }) {
  const { t, formatKZT } = useI18n();
  const { user } = useAuth();
  const navigation = useNavigation();
  const [selectedIds, setSelectedIds] = useState([]);
  const [inspected, setInspected] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [frameWidth, setFrameWidth] = useState(0);
  const scrollRef = useRef(null);

  const canBuy = event.status === "published"; // FS-11: no purchase on unpublished / cancelled events
  const ordered = useMemo(() => orderTiersByPrice(event.ticketTiers), [event.ticketTiers]);
  const palette = useMemo(() => tierColorMap(ordered), [ordered]);
  const { seats, rowCount } = useMemo(() => buildSeatPlan(event.ticketTiers), [event.ticketTiers]);
  const selected = useMemo(() => seats.filter((s) => selectedIds.includes(s.id)), [seats, selectedIds]);
  const total = selected.reduce((sum, s) => sum + s.priceKZT, 0);

  const rowLabel = (seat) => `${t("hybridMap.row", { row: seat.rowNumber })}, ${t("hybridMap.seat", { seat: seat.seatNumber })}`;

  function pressSeat(seat) {
    setInspected(seat);
    if (seat.isOccupied) return;
    setSelectedIds((ids) => (ids.includes(seat.id) ? ids.filter((id) => id !== seat.id) : [...ids, seat.id]));
  }

  function removeSeat(seat) {
    setSelectedIds((ids) => ids.filter((id) => id !== seat.id));
  }

  // web: opens checkout with the first selected seat's tier pre-selected
  function book() {
    if (!canBuy) return;
    const tierId = selected[0]?.tierId || ordered[0]?.id || "";
    if (!tierId) return;
    if (!user) {
      navigation.navigate("SignIn", { next: { screen: "EventDetails", params: { eventId: event.id } } });
      return;
    }
    navigation.navigate("Checkout", { eventId: event.id, tierId });
  }

  // web: min-w-[560px], scaled 0.85–1.4 by the zoom buttons, scrolls sideways when wider than the frame
  const baseWidth = Math.max(frameWidth, SEAT_PLAN.width);
  const width = baseWidth * zoom;
  const height = (width * SEAT_PLAN.height) / SEAT_PLAN.width;
  const rowNumbers = Array.from({ length: rowCount }, (_, i) => i + 1);

  return (
    <View style={st.pane}>
      <View style={st.toolbar}>
        <View style={st.legend}>
          {ordered.map((tier) => {
            const c = palette.get(tier.id) || DEFAULT_COLORS;
            return (
              <View key={tier.id} style={st.legendItem}>
                <View style={[st.swatch, { backgroundColor: c.fill, borderColor: c.border }]} />
                <Text style={st.legendText}>{tier.name} · {formatKZT(tier.priceKZT)}</Text>
              </View>
            );
          })}
          <View style={st.legendItem}>
            <View style={[st.swatch, st.swatchOccupied]} />
            <Text style={st.legendMuted}>{t("hybridMap.occupied")}</Text>
          </View>
          <View style={st.legendItem}>
            <View style={[st.swatch, st.swatchSelected]} />
            <Text style={st.legendSelected}>{t("hybridMap.selected")}</Text>
          </View>
        </View>

        <View style={st.zoom}>
          <ZoomButton label="+" a11y={t("hybridMap.zoomIn")} disabled={zoom >= ZOOM_MAX - 0.001}
            onPress={() => setZoom((z) => Math.min(ZOOM_MAX, +(z + 0.1).toFixed(2)))} />
          <ZoomButton label="−" a11y={t("hybridMap.zoomOut")} disabled={zoom <= ZOOM_MIN + 0.001}
            onPress={() => setZoom((z) => Math.max(ZOOM_MIN, +(z - 0.1).toFixed(2)))} />
          <ZoomButton label="100%" a11y={t("hybridMap.resetView")} wide onPress={() => setZoom(1)} />
        </View>
      </View>

      <View style={st.canvas} onLayout={(e) => setFrameWidth(Math.round(e.nativeEvent.layout.width) - 24)}>
        {/* wider than the phone: open centred on the middle block, under the stage */}
        <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator contentContainerStyle={st.canvasContent}
          onContentSizeChange={(w) => scrollRef.current?.scrollTo({ x: Math.max(0, (w - frameWidth) / 2), animated: false })}>
          <Svg width={width} height={height} viewBox={`0 0 ${SEAT_PLAN.width} ${SEAT_PLAN.height}`} accessibilityLabel={t("hybridMap.title")}>
            <Defs>
              <LinearGradient id="seatScreenGlow" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#94a3b8" stopOpacity="0.25" />
                <Stop offset="1" stopColor="#94a3b8" stopOpacity="0" />
              </LinearGradient>
            </Defs>

            {/* curved stage / screen */}
            <Path d="M 90 28 Q 280 10 470 28 L 500 55 Q 280 40 60 55 Z" fill="url(#seatScreenGlow)" />
            <Path d="M 80 32 Q 280 12 480 32" stroke="#0284c7" strokeWidth={3.5} fill="none" strokeLinecap="round" />
            <SvgText x={280} y={24} textAnchor="middle" fill="#0369a1" fontSize={11} fontWeight="800" letterSpacing={3}>
              {`★ ${t("hybridMap.screen")} ★`}
            </SvgText>

            {rowNumbers.map((r) => {
              const y = SEAT_PLAN.startY + (r - 1) * SEAT_PLAN.rowPitch + 13;
              return (
                <G key={`row-${r}`}>
                  <SvgText x={28} y={y} textAnchor="end" fill={colors.gray400} fontSize={10} fontWeight="700">{String(r)}</SvgText>
                  <SvgText x={532} y={y} textAnchor="start" fill={colors.gray400} fontSize={10} fontWeight="700">{String(r)}</SvgText>
                </G>
              );
            })}

            <SvgText x={148} y={75} textAnchor="middle" fill="#94a3b8" fontSize={8} fontWeight="600" letterSpacing={1}>{t("hybridMap.aisle")}</SvgText>
            <SvgText x={412} y={75} textAnchor="middle" fill="#94a3b8" fontSize={8} fontWeight="600" letterSpacing={1}>{t("hybridMap.aisle")}</SvgText>

            {seats.map((seat) => {
              const isSelected = selectedIds.includes(seat.id);
              const isInspected = inspected?.id === seat.id;
              const c = palette.get(seat.tierId) || DEFAULT_COLORS;
              let fill = c.fill, stroke = c.border, strokeWidth = 1, opacity = 0.95;
              if (seat.isOccupied) { fill = "#e2e8f0"; stroke = "#cbd5e1"; opacity = 0.8; }
              else if (isSelected) { fill = "#10b981"; stroke = "#047857"; strokeWidth = 2; opacity = 1; }
              else if (isInspected) { stroke = "#1e293b"; strokeWidth = 2; opacity = 1; }
              return (
                <G key={seat.id} onPress={() => pressSeat(seat)}>
                  <Rect x={seat.x} y={seat.y} width={SEAT_PLAN.seatSize} height={SEAT_PLAN.seatSize} rx={4}
                    fill={fill} stroke={stroke} strokeWidth={strokeWidth} opacity={opacity} />
                  <SvgText x={seat.x + 9.5} y={seat.y + 12.5} textAnchor="middle" fontSize={8.5} fontWeight="700"
                    fill={seat.isOccupied ? "#94a3b8" : colors.white}>{String(seat.seatNumber)}</SvgText>
                </G>
              );
            })}
          </Svg>
        </ScrollView>
      </View>

      {/* booking summary */}
      <View style={st.summary} accessibilityLiveRegion="polite">
        {selected.length > 0 ? (
          <View style={st.summaryGap}>
            <Text style={st.summaryLabel}>{t("hybridMap.selected")} ({selected.length}):</Text>
            <View style={st.selectedList}>
              {selected.map((s) => (
                <View key={s.id} style={st.seatChip}>
                  <Text style={st.seatChipText}>{rowLabel(s)} <Text style={st.seatChipPrice}>({formatKZT(s.priceKZT)})</Text></Text>
                  <Pressable accessibilityRole="button" accessibilityLabel={`${t("hybridMap.clear")}: ${rowLabel(s)}`}
                    onPress={() => removeSeat(s)} hitSlop={10}>
                    <Text style={st.seatChipRemove}>×</Text>
                  </Pressable>
                </View>
              ))}
              <Pressable accessibilityRole="button" onPress={() => setSelectedIds([])} hitSlop={8}>
                <Text style={st.clear}>{t("hybridMap.clear")}</Text>
              </Pressable>
            </View>
            <View style={st.totalRow}>
              <View>
                <Text style={st.totalLabel}>{t("hybridMap.total")}:</Text>
                <Text style={st.totalValue}>{formatKZT(total)}</Text>
              </View>
              {canBuy ? (
                <Pressable accessibilityRole="button" onPress={book} style={({ pressed }) => [st.book, pressed && st.bookPressed]}>
                  <Text style={st.bookText}>{user ? t("hybridMap.bookSeats") : t("hybridMap.loginToBook")} →</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : inspected ? (
          <View style={st.inspect}>
            <View style={[st.dot, { backgroundColor: palette.get(inspected.tierId)?.fill || DEFAULT_COLORS.fill }]} />
            <Text style={st.inspectText}>
              <Text style={st.bold}>{inspected.tierName}</Text> · {rowLabel(inspected)} ·{" "}
              <Text style={st.bold}>{formatKZT(inspected.priceKZT)}</Text>
              <Text style={st.inspectMuted}>  ({inspected.isOccupied ? t("hybridMap.occupied") : t("hybridMap.clickToSelect")})</Text>
            </Text>
          </View>
        ) : (
          <Text style={st.hint}>👆  {t("hybridMap.hint")}</Text>
        )}
      </View>
    </View>
  );
}

function ZoomButton({ label, a11y, onPress, disabled, wide }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} accessibilityState={{ disabled: !!disabled }}
      disabled={disabled} onPress={onPress} hitSlop={4}
      style={({ pressed }) => [st.zoomButton, wide && st.zoomWide, pressed && st.zoomPressed, disabled && st.zoomDisabled]}>
      <Text style={wide ? st.zoomTextSmall : st.zoomText}>{label}</Text>
    </Pressable>
  );
}

function LocationTab({ event }) {
  const { t } = useI18n();
  const links = mapLinks(event.venueName, event.venueAddress);
  return (
    <View style={st.pane}>
      <View style={st.locationCard}>
        <Text style={st.locationText}>📍 {[event.venueName, event.venueAddress].filter(Boolean).join(" — ")}</Text>
        {links ? (
          <View style={st.locationLinks}>
            <Pressable accessibilityRole="link" onPress={() => Linking.openURL(links.google)} hitSlop={6}>
              <Text style={st.link}>{t("map.openGoogle")} →</Text>
            </Pressable>
            <Pressable accessibilityRole="link" onPress={() => Linking.openURL(links.yandex)} hitSlop={6}>
              <Text style={st.link}>{t("map.openYandex")} →</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function SectorsTab({ event }) {
  const { t, formatKZT } = useI18n();
  const ordered = useMemo(() => orderTiersByPrice(event.ticketTiers), [event.ticketTiers]);
  const palette = useMemo(() => tierColorMap(ordered), [ordered]);
  return (
    <View style={st.pane}>
      <View style={[st.tr, st.thead]}>
        <Text style={[st.th, st.colTier]}>{t("hybridMap.tableSector")}</Text>
        <Text style={[st.th, st.colPrice]}>{t("hybridMap.tablePrice")}</Text>
        <Text style={[st.th, st.colRows]}>{t("hybridMap.tableRows")}</Text>
        <Text style={[st.th, st.colStatus, st.right]}>{t("hybridMap.tableStatus")}</Text>
      </View>
      {ordered.map((tier, i) => {
        const soldOut = tier.remaining !== null && tier.remaining === 0;
        return (
          <View key={tier.id} style={[st.tr, i > 0 && st.trBorder]}>
            <View style={[st.colTier, st.tierCell]}>
              <View style={[st.swatch, { backgroundColor: (palette.get(tier.id) || DEFAULT_COLORS).fill, borderColor: "transparent" }]} />
              <Text style={st.tdStrong}>{tier.name}</Text>
            </View>
            <Text style={[st.tdStrong, st.colPrice]}>{tier.priceKZT > 0 ? formatKZT(tier.priceKZT) : t("common.free")}</Text>
            <Text style={[st.td, st.colRows]}>{t(`hybridMap.${tierRowsKey(i)}`)}</Text>
            <View style={[st.colStatus, st.statusCell]}>
              {soldOut ? (
                <Text style={[st.pill, st.pillGray]}>{t("details.soldOut")}</Text>
              ) : (
                <Text style={[st.pill, st.pillGreen]}>
                  {tier.remaining !== null ? t("details.left", { count: tier.remaining }) : t("hybridMap.available")}
                </Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const st = StyleSheet.create({
  // mt-8 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm
  root: { borderRadius: 16, borderWidth: 1, borderColor: colors.gray200, backgroundColor: colors.white, overflow: "hidden", ...shadow.sm },
  header: { borderBottomWidth: 1, borderBottomColor: colors.gray100, backgroundColor: "rgba(249,250,251,0.8)", paddingHorizontal: 20, paddingVertical: 16 },
  title: { fontSize: 16, fontWeight: "700", color: colors.gray900 },
  subtitle: { marginTop: 2, fontSize: 12, color: colors.gray500 },
  tabs: { gap: 4, marginTop: 12 },
  tab: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  tabActive: { backgroundColor: colors.blue600 },
  tabIdle: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gray200 },
  tabText: { fontSize: 12, fontWeight: "600", color: colors.gray600 },
  tabTextActive: { color: colors.white },
  pane: { padding: 16 },

  toolbar: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottomWidth: 1, borderBottomColor: colors.gray100, paddingBottom: 12, marginBottom: 16 },
  legend: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12, flexShrink: 1 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  swatch: { width: 14, height: 14, borderRadius: 3, borderWidth: 1 },
  swatchOccupied: { backgroundColor: colors.gray200, borderColor: colors.gray300 },
  swatchSelected: { backgroundColor: colors.emerald500, borderColor: colors.emerald600 },
  legendText: { fontSize: 12, fontWeight: "500", color: colors.gray700 },
  legendMuted: { fontSize: 12, color: colors.gray500 },
  legendSelected: { fontSize: 12, fontWeight: "600", color: colors.emerald700 },
  zoom: { flexDirection: "row", gap: 4, backgroundColor: colors.gray100, padding: 2, borderRadius: 6 },
  zoomButton: { minWidth: 30, height: 30, borderRadius: 4, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", ...shadow.sm },
  zoomWide: { paddingHorizontal: 8 },
  zoomPressed: { backgroundColor: colors.gray50 },
  zoomDisabled: { opacity: 0.4 },
  zoomText: { fontSize: 16, fontWeight: "700", color: colors.gray700 },
  zoomTextSmall: { fontSize: 11, fontWeight: "500", color: colors.gray600 },

  // relative overflow-x-auto rounded-xl bg-slate-50/50 p-4 ring-1 ring-gray-100
  canvas: { borderRadius: 12, backgroundColor: "rgba(248,250,252,0.5)", borderWidth: 1, borderColor: colors.gray100, paddingVertical: 12, paddingHorizontal: 12 },
  canvasContent: { flexGrow: 1, justifyContent: "center" },

  summary: { marginTop: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.gray200, backgroundColor: colors.white, padding: 16, ...shadow.sm },
  summaryGap: { gap: 10 },
  summaryLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", color: colors.gray500 },
  selectedList: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  seatChip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, borderWidth: 1, borderColor: "#a7f3d0", backgroundColor: colors.emerald50, paddingHorizontal: 10, paddingVertical: 5 },
  seatChipText: { fontSize: 12, fontWeight: "600", color: colors.emerald800 },
  seatChipPrice: { fontWeight: "400", color: colors.emerald600 },
  seatChipRemove: { fontSize: 16, lineHeight: 16, fontWeight: "700", color: colors.emerald600 },
  clear: { fontSize: 12, color: colors.gray400, textDecorationLine: "underline" },
  totalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, borderTopWidth: 1, borderTopColor: colors.gray100, paddingTop: 10 },
  totalLabel: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", color: colors.gray400 },
  totalValue: { fontSize: 16, fontWeight: "900", color: colors.gray900 },
  book: { borderRadius: 12, backgroundColor: colors.emerald600, paddingHorizontal: 20, paddingVertical: 11, flexShrink: 1, ...shadow.sm },
  bookPressed: { backgroundColor: colors.emerald700 },
  bookText: { fontSize: 14, fontWeight: "700", color: colors.white },
  inspect: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  inspectText: { flex: 1, fontSize: 12, color: colors.gray700 },
  inspectMuted: { color: colors.gray400 },
  bold: { fontWeight: "700", color: colors.gray900 },
  hint: { fontSize: 12, color: colors.gray500 },

  locationCard: { borderRadius: 12, borderWidth: 1, borderColor: colors.gray200, backgroundColor: colors.gray50, padding: 16, gap: 12 },
  locationText: { fontSize: 13, fontWeight: "500", color: colors.gray700 },
  locationLinks: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  link: { fontSize: 13, fontWeight: "600", color: colors.blue600 },

  tr: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12 },
  thead: { borderBottomWidth: 1, borderBottomColor: colors.gray200, paddingTop: 0 },
  trBorder: { borderTopWidth: 1, borderTopColor: colors.gray100 },
  th: { fontSize: 10, fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase", color: colors.gray500 },
  td: { fontSize: 12, color: colors.gray600 },
  tdStrong: { flexShrink: 1, fontSize: 12, fontWeight: "700", color: colors.gray900 },
  colTier: { flex: 1.4 },
  colPrice: { flex: 1 },
  colRows: { flex: 1.1 },
  colStatus: { flex: 1.1 },
  right: { textAlign: "right" },
  tierCell: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusCell: { alignItems: "flex-end" },
  pill: { overflow: "hidden", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, fontSize: 11, fontWeight: "600", textAlign: "center" },
  pillGray: { backgroundColor: colors.gray100, color: colors.gray600 },
  pillGreen: { backgroundColor: colors.emerald50, color: colors.emerald700 }
});
