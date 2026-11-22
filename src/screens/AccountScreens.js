import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { Badge, Button, Field, LanguageSwitcher, LinkButton, Notice } from "../components.js";
import { useAuth } from "../auth.js";
import { useI18n } from "../i18n.js";
import { H1, Muted, Screen, Section } from "../ui.js";
import { colors, shadow } from "../theme.js";

// AuthCard: centered white card on gray-100
function AuthCard({ title, children }) {
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={st.flex}>
      <ScrollView contentContainerStyle={st.authMain} keyboardShouldPersistTaps="handled">
        <View style={st.authCard}>
          <Text accessibilityRole="header" style={st.authTitle}>{title}</Text>
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const SIGN_IN_ERRORS = {
  BAD_CREDENTIALS: "auth.errors.badCredentials",
  NOT_CONFIRMED: "auth.errors.notConfirmed",
  SUSPENDED: "auth.errors.suspended",
  TOO_MANY: "auth.errors.tooMany",
  NETWORK: "auth.errors.NETWORK"
};

// biletflow_web LoginForm (all roles).
export function SignInScreen({ navigation, route }) {
  const { signIn, client, sessionExpired, configError } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notConfirmed, setNotConfirmed] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef(null);
  const next = route.params?.next;

  async function submit() {
    setNotice("");
    setNotConfirmed(false);
    if (!email.trim() || !password) { setError(t("auth.fillAll")); return; }
    setError("");
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      if (next) navigation.replace(next.screen, next.params);
      else if (navigation.canGoBack()) navigation.goBack();
    } catch (e) {
      setNotConfirmed(e.code === "NOT_CONFIRMED");
      setError(t(SIGN_IN_ERRORS[e.code] || "auth.errors.service"));
    }
    setBusy(false);
  }

  async function resend() {
    try { await client.resendVerification(email.trim()); setNotice(t("auth.verificationResent")); }
    catch { setError(t("auth.errors.service")); }
  }

  return (
    <AuthCard title={t("auth.loginTitle")}>
      {configError ? <Notice tone="error" style={st.gap}>{configError}</Notice> : null}
      {sessionExpired && !error ? <Notice tone="warning" style={st.gap}>{t("auth.sessionExpired")}</Notice> : null}
      {error ? <Notice tone="error" role="alert" style={st.gap}>{error}</Notice> : null}
      {notice ? <Notice tone="success" style={st.gap}>{notice}</Notice> : null}
      {notConfirmed ? <Button variant="outlineBlue" small label={t("auth.resendVerification")} onPress={resend} style={st.gap} /> : null}
      <View style={st.form}>
        <Field label={t("auth.email")} value={email} onChangeText={setEmail} editable={!busy} autoCapitalize="none" autoComplete="email"
          autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()} />
        <Field ref={passwordRef} label={t("auth.password")} value={password} onChangeText={setPassword} editable={!busy}
          secureTextEntry autoCapitalize="none" autoComplete="password" textContentType="password" returnKeyType="go" onSubmitEditing={submit} />
        <View style={st.right}><LinkButton label={t("auth.forgot")} onPress={() => navigation.navigate("Forgot")} /></View>
        <Button label={busy ? t("auth.loggingIn") : t("auth.login")} loading={busy} onPress={submit} />
      </View>
      <View style={st.footerRow}>
        <Text style={st.footer}>{t("auth.noAccount")} </Text>
        <LinkButton label={t("auth.signup")} onPress={() => navigation.navigate("SignUp")} />
      </View>
    </AuthCard>
  );
}

// biletflow_web SignupForm
export function SignUpScreen({ navigation }) {
  const { client } = useAuth();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setNotice("");
    if (!name.trim() || !email || !password || !password2) { setError(t("auth.fillAll")); return; }
    if (password.length < 6) { setError(t("auth.errors.shortPassword")); return; }
    if (password !== password2) { setError(t("auth.passwordsMismatch")); return; }
    setError("");
    setBusy(true);
    try {
      const res = await client.signUp(email.trim(), password, name.trim());
      if (res?.email_confirmation_required) setSentTo(email.trim());
      else setNotice(t("auth.signupNoConfirm"));
    } catch (e) {
      if (e.status === 422) setError(t("auth.errors.weakPassword"));
      else if (e.code === "NETWORK") setError(t("auth.errors.NETWORK"));
      else if (e.status && e.status < 500) setError(e.message);
      else setError(t("auth.errors.service"));
    }
    setBusy(false);
  }

  async function resend() {
    try { await client.resendVerification(sentTo); setNotice(t("auth.verificationResent")); }
    catch { setError(t("auth.errors.service")); }
  }

  if (sentTo) {
    return (
      <AuthCard title={t("auth.checkInboxTitle")}>
        <Muted>{t("auth.checkInbox", { email: sentTo })}</Muted>
        {notice ? <Notice tone="success" style={st.gapTop}>{notice}</Notice> : null}
        {error ? <Notice tone="error" style={st.gapTop}>{error}</Notice> : null}
        <Button variant="outlineBlue" label={t("auth.resendVerification")} onPress={resend} style={st.gapTop} />
        <View style={st.center}><LinkButton label={t("auth.toLogin")} onPress={() => navigation.navigate("SignIn")} /></View>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("auth.signupTitle")}>
      {error ? <Notice tone="error" role="alert" style={st.gap}>{error}</Notice> : null}
      {notice ? <Notice tone="success" style={st.gap}>{notice}</Notice> : null}
      <View style={st.form}>
        <Field label={t("auth.name")} value={name} onChangeText={setName} placeholder={t("auth.namePlaceholder")} textContentType="name" />
        <Field label={t("auth.email")} value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" />
        <View>
          <Field label={t("auth.password")} value={password} onChangeText={setPassword} secureTextEntry textContentType="newPassword" />
          <Muted small style={st.hint}>{t("auth.passwordHint")}</Muted>
        </View>
        <Field label={t("auth.confirmPassword")} value={password2} onChangeText={setPassword2} secureTextEntry textContentType="newPassword" />
        <Button label={busy ? t("auth.signingUp") : t("auth.signup")} loading={busy} onPress={submit} />
      </View>
      <View style={st.footerRow}>
        <Text style={st.footer}>{t("auth.haveAccount")} </Text>
        <LinkButton label={t("auth.login")} onPress={() => navigation.navigate("SignIn")} />
      </View>
    </AuthCard>
  );
}

// biletflow_web ForgotPasswordPage (the reset link opens the web reset page)
export function ForgotScreen({ navigation }) {
  const { client } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.trim()) { setError(t("auth.fillAll")); return; }
    setBusy(true);
    setError("");
    try { await client.requestPasswordReset(email.trim()); setSent(true); }
    catch (e) { setError(e.status === 429 ? t("auth.errors.tooMany") : e.code === "NETWORK" ? t("auth.errors.NETWORK") : t("auth.errors.service")); }
    setBusy(false);
  }

  return (
    <AuthCard title={t("auth.forgotTitle")}>
      {sent ? <Notice tone="success">{t("auth.resetSent", { email })}</Notice> : (
        <View style={st.form}>
          <Muted>{t("auth.forgotHint")}</Muted>
          {error ? <Notice tone="error" role="alert">{error}</Notice> : null}
          <Field label={t("auth.email")} value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />
          <Button label={busy ? t("common.loading") : t("auth.sendResetLink")} loading={busy} onPress={submit} />
        </View>
      )}
      <View style={st.center}><LinkButton label={t("auth.toLogin")} onPress={() => navigation.navigate("SignIn")} /></View>
    </AuthCard>
  );
}

// Account tab: guest prompt or profile summary, language, logout.
export function AccountScreen({ navigation }) {
  const { user, signOut, isStaff, offline } = useAuth();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  return (
    <Screen>
      <H1>{t("account.title")}</H1>
      <Section title={t("account.language")}>
        <View style={st.left}><LanguageSwitcher /></View>
      </Section>
      {user ? (
        <>
          <Section>
            <Text style={st.name}>{user.full_name || user.email}</Text>
            <Muted>{user.email}</Muted>
            <View style={st.top8}><Badge tone="blue" label={t(`roles.${user.role}`, { defaultValue: user.role })} /></View>
            {offline ? <Notice tone="warning" style={st.top8}>{t("events.offline")}</Notice> : null}
            {isStaff ? <Muted small style={st.top8}>{t("account.staffHint")}</Muted> : null}
          </Section>
          <Button variant="outline" label={t("account.profile")} onPress={() => navigation.navigate("Profile")} />
          <Button variant="danger" label={t("nav.logout")} loading={busy}
            onPress={async () => { setBusy(true); await signOut(); setBusy(false); }} />
        </>
      ) : (
        <Section>
          <Muted>{t("account.guestTitle")}</Muted>
          <View style={st.stack}>
            <Button label={t("account.login")} onPress={() => navigation.navigate("SignIn")} />
            <Button variant="outlineBlue" label={t("account.signup")} onPress={() => navigation.navigate("SignUp")} />
          </View>
        </Section>
      )}
    </Screen>
  );
}

// biletflow_web ProfilePage
export function ProfileScreen() {
  const { client, user, applyProfile, isOrganizer } = useAuth();
  const { t } = useI18n();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [payout, setPayout] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    client.getProfile().then((p) => {
      setFullName(p.full_name || "");
      setPhone(p.phone_number || "");
      setPayout(p.payout_info || "");
    }).catch((e) => setError(e.message));
  }, [client]);

  async function save() {
    if (!fullName.trim()) { setError(t("profile.nameRequired")); return; }
    setSaving(true);
    setError("");
    setMessage("");
    const body = { full_name: fullName.trim(), phone_number: phone.trim() };
    if (isOrganizer) body.payout_info = payout.trim();
    try {
      const p = await client.updateProfile(body);
      applyProfile({ ...p, email: p.email || user?.email });
      setMessage(t("profile.saved"));
    } catch (e) {
      setError(t("profile.saveFailed", { reason: e.message }));
    }
    setSaving(false);
  }

  return (
    <Screen keyboard>
      <View>
        <H1>{t("profile.title")}</H1>
        <Muted>{user?.email} · {t(`roles.${user?.role || "attendee"}`)}</Muted>
      </View>
      <Section>
        <View style={st.form}>
          {message ? <Notice tone="success">{message}</Notice> : null}
          {error ? <Notice tone="error" role="alert">{error}</Notice> : null}
          <Field label={t("profile.fullName")} value={fullName} onChangeText={setFullName} />
          <Field label={t("profile.phone")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+7 7XX XXX XX XX" />
          {isOrganizer ? (
            <View>
              <Field label={t("profile.payout")} value={payout} onChangeText={setPayout} autoCapitalize="characters" />
              <Muted small style={st.hint}>{t("profile.payoutHint")}</Muted>
            </View>
          ) : null}
          <Button label={saving ? t("common.saving") : t("common.save")} loading={saving} onPress={save} />
        </View>
      </Section>
    </Screen>
  );
}

const st = StyleSheet.create({
  flex: { flex: 1 },
  authMain: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 16, backgroundColor: colors.gray100 },
  authCard: { width: "100%", maxWidth: 448, backgroundColor: colors.white, borderRadius: 8, padding: 24, ...shadow.md },
  authTitle: { textAlign: "center", fontSize: 24, fontWeight: "700", color: colors.gray800, marginBottom: 20 },
  gap: { marginBottom: 16 },
  gapTop: { marginTop: 12 },
  form: { gap: 16 },
  right: { alignItems: "flex-end" },
  left: { alignItems: "flex-start" },
  center: { alignItems: "center", marginTop: 16 },
  hint: { marginTop: 4 },
  footerRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", flexWrap: "wrap", marginTop: 16 },
  footer: { fontSize: 14, color: colors.gray600 },
  name: { fontSize: 18, fontWeight: "700", color: colors.gray900 },
  top8: { marginTop: 8, alignItems: "flex-start" },
  stack: { gap: 10, marginTop: 14 }
});
