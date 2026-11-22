import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LANGUAGES } from "./strings.js";
import { useI18n } from "./i18n.js";
import { colors, shadow, tones } from "./theme.js";

// <nav className="flex flex-wrap items-center justify-between gap-3 bg-white px-6 py-4 shadow-sm">
export function Navbar({ user, onLogout, busy }) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.nav, { paddingTop: insets.top + 12 }]}>
      <View style={s.navRow}>
        <Text accessibilityRole="header" style={s.brand}>BiletFlow</Text>
        <View style={s.navRight}>
          <LanguageSwitcher />
          {user ? (
            <Pressable accessibilityRole="button" disabled={busy} onPress={onLogout}
              style={({ pressed }) => [s.outlineSmall, (pressed || busy) && s.pressed]}>
              <Text style={s.outlineSmallText}>{t("nav.logout")}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {user ? (
        <View style={s.navRow2}>
          <View style={s.navPillActive}><Text style={s.navPillActiveText}>{t("nav.events")}</Text></View>
          <Text numberOfLines={1} style={s.hello}>
            {t("nav.hello", { name: user.full_name || user.email })} · {t(`roles.${user.role}`)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// LanguageSwitcher.tsx: segmented KK | RU | EN, active = bg-blue-600 text-white
export function LanguageSwitcher() {
  const { lang, setLang } = useI18n();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Language" style={s.langGroup}>
      {LANGUAGES.map((code, index) => {
        const active = code === lang;
        return (
          <Pressable key={code} accessibilityRole="radio" accessibilityState={{ selected: active }}
            onPress={() => setLang(code)}
            style={[s.langButton, index > 0 && s.langDivider, active && s.langActive]}>
            <Text style={[s.langText, active && s.langTextActive]}>{code.toUpperCase()}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const BUTTON_VARIANTS = {
  primary: { bg: colors.blue600, fg: colors.white, border: colors.blue600 },
  success: { bg: colors.emerald600, fg: colors.white, border: colors.emerald600 },
  outline: { bg: colors.white, fg: colors.gray700, border: colors.gray300 },
  outlineBlue: { bg: colors.white, fg: colors.blue700, border: colors.blue600 },
  danger: { bg: colors.white, fg: colors.red700, border: colors.red600 }
};

export function Button({ label, onPress, variant = "primary", disabled, loading, small, style, accessibilityLabel }) {
  const v = BUTTON_VARIANTS[variant];
  const inactive = disabled || loading;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive} onPress={onPress}
      style={({ pressed }) => [
        s.button, small && s.buttonSmall,
        { backgroundColor: v.bg, borderColor: v.border },
        pressed && s.pressed, inactive && s.disabled, style
      ]}>
      {loading ? <ActivityIndicator color={v.fg} /> : <Text style={[s.buttonText, small && s.buttonTextSmall, { color: v.fg }]}>{label}</Text>}
    </Pressable>
  );
}

export function LinkButton({ label, onPress, disabled }) {
  return (
    <Pressable accessibilityRole="link" disabled={disabled} onPress={onPress} hitSlop={8}
      style={({ pressed }) => [pressed && s.pressed, disabled && s.disabled]}>
      <Text style={s.link}>{label}</Text>
    </Pressable>
  );
}

// AuthCard Field: label text-sm font-medium text-gray-700, input rounded-md border-gray-300
export function Field({ label, style, ...inputProps }) {
  return (
    <View style={style}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <TextInput placeholderTextColor={colors.gray400} style={s.input} accessibilityLabel={label} {...inputProps} />
    </View>
  );
}

// <p className="rounded bg-red-100 p-3 text-sm text-red-700">
export function Notice({ tone = "info", children, title, role, style, items, onClose }) {
  const c = tones[tone];
  return (
    <View accessibilityRole={role} accessibilityLiveRegion={role === "alert" ? "assertive" : "polite"}
      style={[s.notice, { backgroundColor: c.bg }, style]}>
      <View style={s.noticeRow}>
        <View style={s.flex}>
          {title ? <Text style={[s.noticeTitle, { color: c.strong }]}>{title}</Text> : null}
          {typeof children === "string" ? <Text style={[s.noticeText, { color: c.text }]}>{children}</Text> : children}
          {items?.length ? items.map((item) => <Text key={item} style={[s.noticeText, { color: c.text }]}>• {item}</Text>) : null}
        </View>
        {onClose ? (
          <Pressable accessibilityRole="button" accessibilityLabel="×" hitSlop={10} onPress={onClose}>
            <Text style={[s.noticeClose, { color: c.text }]}>×</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// rounded-xl border border-gray-100 bg-white shadow-sm
export function Card({ children, style }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Badge({ label, tone = "neutral" }) {
  const palette = tone === "neutral"
    ? { bg: colors.gray100, fg: colors.gray700 }
    : tone === "blue" ? { bg: colors.blue100, fg: colors.blue700 }
      : tone === "purple" ? { bg: "#f3e8ff", fg: "#6b21a8" }
        : { bg: tones[tone].bg, fg: tones[tone].strong };
  return (
    <View style={[s.badge, { backgroundColor: palette.bg }]}>
      <Text style={[s.badgeText, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

// Nav pills: rounded-md px-3 py-1 text-sm font-medium, active bg-blue-600 text-white
export function PillTabs({ tabs, value, onChange, disabled }) {
  return (
    <View accessibilityRole="tablist" style={s.pills}>
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <Pressable key={tab.value} accessibilityRole="tab" accessibilityState={{ selected: active, disabled }}
            disabled={disabled} onPress={() => onChange(tab.value)}
            style={[s.pill, active ? s.pillActive : s.pillIdle, disabled && !active && s.disabled]}>
            <Text style={[s.pillText, active && s.pillTextActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ConfirmDialog({ visible, title, body, confirmLabel, cancelLabel, danger, onConfirm, onCancel }) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <View style={s.backdrop}>
        <View accessibilityViewIsModal style={s.dialog}>
          <Text accessibilityRole="header" style={s.dialogTitle}>{title}</Text>
          {body ? <Text style={s.dialogBody}>{body}</Text> : null}
          <View style={s.dialogActions}>
            <Button small variant="outline" label={cancelLabel} onPress={onCancel} style={s.flex} />
            <Button small variant={danger ? "danger" : "primary"} label={confirmLabel} onPress={onConfirm} style={s.flex} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export const s = StyleSheet.create({
  flex: { flex: 1 },
  nav: { backgroundColor: colors.white, paddingHorizontal: 16, paddingBottom: 12, ...shadow.sm, zIndex: 2 },
  navRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  navRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  navRow2: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  brand: { fontSize: 20, fontWeight: "700", color: colors.blue600 },
  hello: { flex: 1, fontSize: 13, color: colors.gray600, fontWeight: "500" },
  navPillActive: { backgroundColor: colors.blue600, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 4 },
  navPillActiveText: { color: colors.white, fontSize: 14, fontWeight: "500" },
  outlineSmall: { borderWidth: 1, borderColor: colors.gray300, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 5 },
  outlineSmallText: { fontSize: 14, fontWeight: "500", color: colors.gray900 },
  langGroup: { flexDirection: "row", borderWidth: 1, borderColor: colors.gray300, borderRadius: 6, overflow: "hidden" },
  langButton: { paddingHorizontal: 8, paddingVertical: 5, backgroundColor: colors.white },
  langDivider: { borderLeftWidth: 1, borderLeftColor: colors.gray300 },
  langActive: { backgroundColor: colors.blue600 },
  langText: { fontSize: 12, fontWeight: "600", color: colors.gray700 },
  langTextActive: { color: colors.white },
  button: { minHeight: 46, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  buttonSmall: { minHeight: 38, borderRadius: 6, paddingHorizontal: 12 },
  buttonText: { fontSize: 16, fontWeight: "600" },
  buttonTextSmall: { fontSize: 14, fontWeight: "500" },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
  link: { color: colors.blue600, fontSize: 14, fontWeight: "600" },
  label: { marginBottom: 4, fontSize: 14, fontWeight: "500", color: colors.gray700 },
  input: { borderWidth: 1, borderColor: colors.gray300, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 10, fontSize: 15, color: colors.gray900, backgroundColor: colors.white },
  notice: { borderRadius: 8, padding: 12 },
  noticeTitle: { fontSize: 15, fontWeight: "700", marginBottom: 2 },
  noticeText: { fontSize: 14, lineHeight: 20 },
  noticeRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  noticeClose: { fontSize: 20, lineHeight: 20, opacity: 0.7 },
  card: { backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.gray100, ...shadow.sm, overflow: "hidden" },
  badge: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: "600" },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  pillActive: { backgroundColor: colors.blue600 },
  pillIdle: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gray200 },
  pillText: { fontSize: 14, fontWeight: "500", color: colors.gray700 },
  pillTextActive: { color: colors.white },
  backdrop: { flex: 1, backgroundColor: "rgba(17,24,39,0.5)", alignItems: "center", justifyContent: "center", padding: 20 },
  dialog: { width: "100%", maxWidth: 420, backgroundColor: colors.white, borderRadius: 8, padding: 20, ...shadow.md },
  dialogTitle: { fontSize: 18, fontWeight: "700", color: colors.gray800 },
  dialogBody: { marginTop: 8, fontSize: 14, lineHeight: 20, color: colors.gray600 },
  dialogActions: { flexDirection: "row", gap: 10, marginTop: 18 }
});
