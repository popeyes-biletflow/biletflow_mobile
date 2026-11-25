// Web-style building blocks (Tailwind classes from biletflow_web mapped to React Native).
import { useMemo, useState } from "react";
import { FlatList, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import QRCode from "qrcode";
import { Button } from "./components.js";
import { useI18n } from "./i18n.js";
import { isLocalInput } from "./models.js";
import { colors, shadow } from "./theme.js";

let DateTimePicker = null;
let DateTimePickerAndroid = null;
if (Platform.OS !== "web") {
  // eslint-disable-next-line global-require
  const picker = require("@react-native-community/datetimepicker");
  DateTimePicker = picker.default;
  DateTimePickerAndroid = picker.DateTimePickerAndroid;
}

/** <main className="mx-auto max-w-* p-6"> with pull-to-refresh. */
export function Screen({ children, refreshing, onRefresh, contentStyle, keyboard }) {
  return (
    <ScrollView style={u.screen} contentContainerStyle={[u.content, contentStyle]}
      keyboardShouldPersistTaps={keyboard ? "handled" : "never"}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} colors={[colors.blue600]} tintColor={colors.blue600} /> : undefined}>
      {children}
    </ScrollView>
  );
}

export function H1({ children, style }) {
  return <Text accessibilityRole="header" style={[u.h1, style]}>{children}</Text>;
}
export function H2({ children, style }) {
  return <Text accessibilityRole="header" style={[u.h2, style]}>{children}</Text>;
}
export function Muted({ children, style, small }) {
  return <Text style={[small ? u.mutedSmall : u.muted, style]}>{children}</Text>;
}
export function Body({ children, style }) {
  return <Text style={[u.body, style]}>{children}</Text>;
}

/** rounded-xl border border-gray-100 bg-white p-5 shadow-sm */
export function Section({ title, children, style, right }) {
  return (
    <View style={[u.section, style]}>
      {title ? (
        <View style={u.sectionHead}>
          <Text accessibilityRole="header" style={u.sectionTitle}>{title}</Text>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function StatCard({ label, value, sub }) {
  return (
    <View style={u.stat}>
      <Text style={u.statLabel}>{label}</Text>
      <Text style={u.statValue}>{value}</Text>
      {sub ? <Text style={u.statSub}>{sub}</Text> : null}
    </View>
  );
}

export function StatGrid({ children }) {
  return <View style={u.statGrid}>{children}</View>;
}

/** h-2 rounded-full bg-blue-100 / bg-blue-600 */
export function ProgressBar({ value }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return <View style={u.bar}><View style={[u.barFill, { width: `${pct}%` }]} /></View>;
}

/** label / value row (order breakdowns) */
export function Row({ label, value, strong, tone, style }) {
  const color = tone === "success" ? colors.emerald700 : tone === "muted" ? colors.gray600 : colors.gray900;
  return (
    <View style={[u.row, strong && u.rowStrong, style]}>
      <Text style={[u.rowLabel, { color: tone ? color : colors.gray600 }, strong && u.rowLabelStrong]}>{label}</Text>
      <Text style={[u.rowValue, { color }, strong && u.rowValueStrong]}>{value}</Text>
    </View>
  );
}

/** rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center */
export function EmptyState({ children, action }) {
  return (
    <View style={u.empty}>
      <Text style={u.emptyText}>{children}</Text>
      {action}
    </View>
  );
}

/** Underlined tabs (border-b-2 border-blue-600 text-blue-600), horizontally scrollable. */
export function UnderlineTabs({ tabs, value, onChange }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={u.utabsWrap} contentContainerStyle={u.utabs}>
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <Pressable key={tab.value} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => onChange(tab.value)}
            style={[u.utab, active && u.utabActive]}>
            <Text style={[u.utabText, active && u.utabTextActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Bordered selectable option (border-blue-500 bg-blue-50 when selected). */
export function OptionCard({ selected, disabled, onPress, title, subtitle, right, error, tone = "blue" }) {
  const activeColors = tone === "emerald" ? [colors.emerald500, colors.emerald50] : tone === "amber" ? [colors.amber500, colors.amber50] : [colors.blue500, colors.blue50];
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress}
      style={[u.option, selected && { borderColor: activeColors[0], backgroundColor: activeColors[1] }, disabled && u.dim]}>
      <View style={[u.radio, selected && { borderColor: activeColors[0] }]}>{selected ? <View style={[u.radioDot, { backgroundColor: activeColors[0] }]} /> : null}</View>
      <View style={u.flex}>
        <Text style={u.optionTitle}>{title}</Text>
        {error ? <Text style={u.optionError}>{error}</Text> : subtitle ? <Text style={u.optionSub}>{subtitle}</Text> : null}
      </View>
      {right ? <Text style={u.optionRight}>{right}</Text> : null}
    </Pressable>
  );
}

export function Checkbox({ checked, onChange, label, disabled }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked, disabled }} disabled={disabled}
      onPress={() => onChange(!checked)} style={[u.check, disabled && u.dim]}>
      <View style={[u.checkBox, checked && u.checkBoxOn]}>{checked ? <Text style={u.checkMark}>✓</Text> : null}</View>
      <Text style={u.checkLabel}>{label}</Text>
    </Pressable>
  );
}

export function TextArea({ label, value, onChangeText, rows = 4, maxLength, placeholder, editable = true }) {
  return (
    <View>
      {label ? <Text style={u.label}>{label}</Text> : null}
      <TextInput multiline value={value} onChangeText={onChangeText} maxLength={maxLength} placeholder={placeholder}
        editable={editable} accessibilityLabel={label} placeholderTextColor={colors.gray400}
        style={[u.input, { minHeight: rows * 22 + 16, textAlignVertical: "top" }]} />
    </View>
  );
}

/** <select> replacement: opens a modal list. */
export function SelectField({ label, value, options, onChange, placeholder }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <View>
      {label ? <Text style={u.label}>{label}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => setOpen(true)} style={[u.input, u.selectBox]}>
        <Text style={[u.selectText, !current && { color: colors.gray400 }]} numberOfLines={1}>{current ? current.label : placeholder || t("picker.choose")}</Text>
        <Text style={u.chevron}>▾</Text>
      </Pressable>
      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={u.backdrop} onPress={() => setOpen(false)}>
          <View style={u.sheet}>
            {label ? <Text style={u.sheetTitle}>{label}</Text> : null}
            <FlatList data={options} keyExtractor={(o) => String(o.value)}
              renderItem={({ item }) => (
                <Pressable accessibilityRole="menuitem" onPress={() => { onChange(item.value); setOpen(false); }}
                  style={[u.sheetItem, item.value === value && u.sheetItemActive]}>
                  <Text style={[u.sheetItemText, item.value === value && u.sheetItemTextActive]}>{item.label}</Text>
                </Pressable>
              )} />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const pad = (n) => String(n).padStart(2, "0");
// value: "YYYY-MM-DDTHH:mm" in Almaty wall time (UTC+5), same as the web datetime-local inputs.
function toDate(value, mode) {
  if (!value) return new Date();
  const [d, tm = "00:00"] = value.split("T");
  const iso = mode === "date" ? `${d}T00:00:00+05:00` : `${d}T${tm}:00+05:00`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}
function fromDate(date, mode) {
  const shifted = new Date(date.getTime() + 5 * 3600000);
  const day = `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
  return mode === "date" ? day : `${day}T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`;
}

/** Event date and time selection uses the platform picker in Almaty time. */
export function DateTimeField({ label, value, onChange, mode = "datetime", hint, disabled }) {
  const { t } = useI18n();
  const [draftDate, setDraftDate] = useState(null);
  const display = value ? value.replace("T", " ") : "";

  if (Platform.OS === "web" && mode === "datetime") {
    return (
      <View>
        {label ? <Text style={u.label}>{label}</Text> : null}
        <input type="datetime-local" aria-label={label} value={value ?? ""} disabled={disabled}
          onChange={(event) => onChange(event.currentTarget.value)}
          style={{ border: `1px solid ${colors.gray300}`, borderRadius: 6, padding: 10,
            fontSize: 15, color: colors.gray900, backgroundColor: colors.white }} />
        {hint ? <Text style={u.hint}>{hint}</Text> : null}
      </View>
    );
  }

  if (!DateTimePicker) {
    return (
      <View>
        {label ? <Text style={u.label}>{label}</Text> : null}
        <TextInput value={display} editable={!disabled} placeholder={mode === "date" ? "YYYY-MM-DD" : t("picker.formatHint")}
          placeholderTextColor={colors.gray400} accessibilityLabel={label} style={u.input}
          onChangeText={(text) => {
            const v = mode === "date" ? text.trim() : text.trim().replace(" ", "T");
            if (!v) onChange("");
            else if (mode === "date" ? /^\d{4}-\d{2}-\d{2}$/.test(v) : isLocalInput(v)) onChange(v);
          }} />
        {hint ? <Text style={u.hint}>{hint}</Text> : null}
      </View>
    );
  }

  function openPicker() {
    if (Platform.OS === "ios") {
      setDraftDate(toDate(value, mode));
      return;
    }

    DateTimePickerAndroid.open({
      value: toDate(value, mode),
      mode: "date",
      timeZoneName: "Asia/Almaty",
      onValueChange: (_, date) => {
        const day = fromDate(date, "date");
        if (mode === "date") {
          onChange(day);
          return;
        }

        const time = value?.split("T")[1] || "10:00";
        DateTimePickerAndroid.open({
          value: toDate(`${day}T${time}`, mode),
          mode: "time",
          is24Hour: true,
          timeZoneName: "Asia/Almaty",
          onValueChange: (_, selectedTime) => {
            const [, hoursAndMinutes] = fromDate(selectedTime, "datetime").split("T");
            onChange(`${day}T${hoursAndMinutes}`);
          }
        });
      }
    });
  }

  return (
    <View>
      {label ? <Text style={u.label}>{label}</Text> : null}
      <View style={u.dtRow}>
        <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled}
          onPress={openPicker} style={[u.input, u.selectBox, u.flex, disabled && u.dim]}>
          <Text style={[u.selectText, !value && { color: colors.gray400 }]}>{display || t("picker.choose")}</Text>
        </Pressable>
        {value && !disabled ? <Button small variant="outline" label={t("picker.clear")} onPress={() => onChange("")} /> : null}
      </View>
      {hint ? <Text style={u.hint}>{hint}</Text> : null}
      {draftDate ? (
        <Modal transparent animationType="fade" visible onRequestClose={() => setDraftDate(null)}>
          <View style={u.backdrop}>
            <View style={u.sheet}>
              <DateTimePicker value={draftDate} mode={mode === "date" ? "date" : "datetime"} display="inline"
                timeZoneName="Asia/Almaty" locale="ru-RU"
                onValueChange={(_, date) => setDraftDate(date)} />
              <Button label={t("picker.done")} onPress={() => {
                onChange(fromDate(draftDate, mode));
                setDraftDate(null);
              }} />
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

/** Black-on-white QR with quiet zone (same as the web QRCodeSVG level M, marginSize 4). */
export function QRCodeView({ value, size = 220, accessibilityLabel }) {
  const { path, count } = useMemo(() => {
    const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
    const n = qr.modules.size;
    const data = qr.modules.data;
    let d = "";
    for (let y = 0; y < n; y += 1) {
      for (let x = 0; x < n; x += 1) {
        if (data[y * n + x]) d += `M${x + 4} ${y + 4}h1v1h-1z`;
      }
    }
    return { path: d, count: n + 8 };
  }, [value]);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} style={u.qrBox}>
      <Svg width={size} height={size} viewBox={`0 0 ${count} ${count}`} shapeRendering="crispEdges">
        <Rect x={0} y={0} width={count} height={count} fill="#FFFFFF" />
        <Path d={path} fill="#000000" />
      </Svg>
    </View>
  );
}

export const u = StyleSheet.create({
  flex: { flex: 1 },
  dim: { opacity: 0.55 },
  screen: { flex: 1, backgroundColor: colors.gray50 },
  content: { padding: 16, paddingBottom: 40, gap: 16 },
  h1: { fontSize: 28, fontWeight: "800", color: colors.gray900 },
  h2: { fontSize: 20, fontWeight: "700", color: colors.gray900 },
  muted: { fontSize: 14, lineHeight: 20, color: colors.gray600 },
  mutedSmall: { fontSize: 12, lineHeight: 17, color: colors.gray500 },
  body: { fontSize: 15, lineHeight: 22, color: colors.gray700 },
  section: { backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.gray100, padding: 16, ...shadow.sm },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: colors.gray900, flexShrink: 1 },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: { flexGrow: 1, flexBasis: "45%", backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.gray100, padding: 14, ...shadow.sm },
  statLabel: { fontSize: 12, color: colors.gray500 },
  statValue: { marginTop: 4, fontSize: 22, fontWeight: "600", color: colors.gray900 },
  statSub: { marginTop: 2, fontSize: 12, color: colors.gray500 },
  bar: { height: 8, borderRadius: 4, backgroundColor: colors.blue100, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4, backgroundColor: colors.blue600 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 3 },
  rowStrong: { borderTopWidth: 1, borderTopColor: colors.gray200, marginTop: 6, paddingTop: 8 },
  rowLabel: { fontSize: 14, flexShrink: 1 },
  rowLabelStrong: { fontWeight: "700", color: colors.gray900, fontSize: 16 },
  rowValue: { fontSize: 14 },
  rowValueStrong: { fontWeight: "700", fontSize: 16 },
  empty: { borderWidth: 1, borderStyle: "dashed", borderColor: colors.gray300, backgroundColor: colors.white, borderRadius: 12, padding: 28, alignItems: "center", gap: 12 },
  emptyText: { fontSize: 15, color: colors.gray500, textAlign: "center", lineHeight: 21 },
  utabsWrap: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: colors.gray200 },
  utabs: { gap: 22, paddingRight: 8 },
  utab: { paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: "transparent" },
  utabActive: { borderBottomColor: colors.blue600 },
  utabText: { fontSize: 14, fontWeight: "600", color: colors.gray500 },
  utabTextActive: { color: colors.blue600 },
  option: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: colors.gray200, borderRadius: 8, padding: 12, backgroundColor: colors.white },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.gray400, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 8, height: 8, borderRadius: 4 },
  optionTitle: { fontSize: 14, color: colors.gray900, fontWeight: "500" },
  optionSub: { fontSize: 12, color: colors.gray500, marginTop: 2 },
  optionError: { fontSize: 12, color: colors.red600, marginTop: 2 },
  optionRight: { fontSize: 14, fontWeight: "700", color: colors.gray900 },
  check: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  checkBox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: colors.gray400, alignItems: "center", justifyContent: "center", marginTop: 1 },
  checkBoxOn: { backgroundColor: colors.blue600, borderColor: colors.blue600 },
  checkMark: { color: colors.white, fontSize: 13, fontWeight: "800", lineHeight: 15 },
  checkLabel: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.gray700 },
  label: { marginBottom: 4, fontSize: 14, fontWeight: "500", color: colors.gray700 },
  hint: { marginTop: 4, fontSize: 12, color: colors.gray500 },
  input: { borderWidth: 1, borderColor: colors.gray300, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 10, fontSize: 15, color: colors.gray900, backgroundColor: colors.white },
  selectBox: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 },
  selectText: { fontSize: 15, color: colors.gray900, flexShrink: 1 },
  chevron: { fontSize: 14, color: colors.gray500, marginLeft: 8 },
  dtRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  backdrop: { flex: 1, backgroundColor: "rgba(17,24,39,0.5)", justifyContent: "center", padding: 20 },
  sheet: { maxHeight: "75%", backgroundColor: colors.white, borderRadius: 12, padding: 12, gap: 8, ...shadow.md },
  sheetTitle: { fontSize: 15, fontWeight: "700", color: colors.gray800, padding: 6 },
  sheetItem: { paddingVertical: 12, paddingHorizontal: 10, borderRadius: 8 },
  sheetItemActive: { backgroundColor: colors.blue50 },
  sheetItemText: { fontSize: 15, color: colors.gray800 },
  sheetItemTextActive: { color: colors.blue700, fontWeight: "600" },
  qrBox: { backgroundColor: colors.white, padding: 8, alignSelf: "center" }
});
