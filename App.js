import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Speech from "expo-speech";
import * as SecureStore from "expo-secure-store";
import { getAssignedEvents, isNetworkError, signIn, validateTicket } from "./src/adminApi";
import {
  cacheEvents,
  cacheScan,
  clearLocalCache,
  getCachedEvents,
  getCachedScan
} from "./src/localCache";

const TOKEN_KEY = "biletflow_admin_access_token";
const COLORS = {
  background: "#0B0D0A",
  surface: "#151813",
  surfaceRaised: "#1C2019",
  border: "#2A3024",
  text: "#F5F6F0",
  muted: "#9A9E91",
  accent: "#D6FB54",
  error: "#FF8D80",
  black: "#0B0D0A"
};

function Brand({ compact = false }) {
  return (
    <View style={styles.brand}>
      <View style={styles.brandMark}><Text style={styles.brandMarkText}>b</Text></View>
      <View>
        <Text style={styles.brandName}>biletflow</Text>
        {!compact && <Text style={styles.brandCaption}>EVENT OPERATIONS</Text>}
      </View>
    </View>
  );
}

function PrimaryButton({ label, onPress, disabled, loading, secondary = false }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        secondary && styles.secondaryButton,
        (pressed || disabled || loading) && styles.buttonDimmed
      ]}
    >
      {loading
        ? <ActivityIndicator color={secondary ? COLORS.text : COLORS.black} />
        : <Text style={[styles.primaryButtonText, secondary && styles.secondaryButtonText]}>{label}</Text>}
    </Pressable>
  );
}

function SignInScreen({ onSignIn, error, busy }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function submit() {
    onSignIn(email.trim(), password);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.flex}
    >
      <ScrollView
        contentContainerStyle={styles.signInContent}
        keyboardShouldPersistTaps="handled"
      >
        <Brand />
        <View style={styles.signInIntro}>
          <View style={styles.eyebrow}><View style={styles.liveDot} /><Text style={styles.eyebrowText}>ADMIN ACCESS</Text></View>
          <Text style={styles.heading}>Your events,{`\n`}under control.</Text>
          <Text style={styles.bodyCopy}>Sign in to manage entry and keep your event moving.</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>WORK EMAIL</Text>
          <TextInput
            accessibilityLabel="Work email"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            editable={!busy}
            keyboardType="email-address"
            onChangeText={setEmail}
            onSubmitEditing={submit}
            placeholder="you@company.com"
            placeholderTextColor="#70756A"
            returnKeyType="next"
            style={styles.input}
            textContentType="emailAddress"
            value={email}
          />
          <Text style={[styles.label, styles.passwordLabel]}>PASSWORD</Text>
          <TextInput
            accessibilityLabel="Password"
            autoCapitalize="none"
            autoComplete="password"
            editable={!busy}
            onChangeText={setPassword}
            onSubmitEditing={submit}
            placeholder="Enter your password"
            placeholderTextColor="#70756A"
            returnKeyType="go"
            secureTextEntry
            style={styles.input}
            textContentType="password"
            value={password}
          />
          {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
          <PrimaryButton
            label="Sign in"
            loading={busy}
            onPress={submit}
          />
          <Text style={styles.secureNote}>Your account is protected with secure sign-in.</Text>
        </View>
        <Text style={styles.footer}>NEED ACCESS? CONTACT YOUR EVENT ORGANIZER</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function formatEventDate(value) {
  if (!value) return "Date to be announced";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function EventsScreen({ events, error, onSelect, onSignOut }) {
  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Brand compact />
        <Pressable accessibilityRole="button" onPress={onSignOut} style={styles.signOutButton}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.eventsContent}>
        <Text style={styles.sectionKicker}>YOUR WORKSPACE</Text>
        <Text style={styles.heading}>Choose an event</Text>
        <Text style={styles.bodyCopy}>Select an assigned event to open its ticket scanner.</Text>

        {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}

        {events.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}><Text style={styles.emptyIconText}>—</Text></View>
            <Text style={styles.emptyTitle}>No events assigned yet</Text>
            <Text style={styles.emptyCopy}>When an organizer assigns you to an event, it will appear here.</Text>
          </View>
        ) : (
          <View style={styles.eventList}>
            {events.map((event, index) => (
              <Pressable
                accessibilityRole="button"
                key={event.id}
                onPress={() => onSelect(event)}
                style={({ pressed }) => [styles.eventCard, pressed && styles.cardPressed]}
              >
                <View style={styles.eventCardTop}>
                  <View style={styles.eventIcon}><Text style={styles.eventIconText}>↗</Text></View>
                  <Text style={styles.eventNumber}>EVENT 0{index + 1}</Text>
                </View>
                <Text style={styles.eventName}>{event.name}</Text>
                <Text style={styles.eventMeta}>{formatEventDate(event.startsAt)}</Text>
                {event.venue ? <Text style={styles.eventMeta}>{event.venue}</Text> : null}
                <View style={styles.eventCardBottom}>
                  <Text style={styles.eventAction}>OPEN SCANNER</Text>
                  <Text style={styles.eventArrow}>→</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
        <Text style={styles.footer}>ONLY EVENTS ASSIGNED TO YOUR ACCOUNT ARE SHOWN</Text>
      </ScrollView>
    </View>
  );
}

function ScannerScreen({ event, token, onBack }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [result, setResult] = useState(null);
  const [processing, setProcessing] = useState(false);
  const processingRef = useRef(false);

  function showResult(nextResult) {
    setResult(nextResult);
    Speech.stop();
    Speech.speak(nextResult.speech);
  }

  async function handleBarcodeScanned({ data }) {
    if (processingRef.current || result) return;
    if (typeof data !== "string" || !data.trim()) {
      showResult({
        status: "error",
        title: "QR CODE UNREADABLE",
        message: "This QR code did not contain a ticket payload.",
        speech: "QR code unreadable"
      });
      return;
    }

    processingRef.current = true;
    setProcessing(true);
    Speech.stop();
    Speech.speak("Checking ticket");
    try {
      const previousScan = await getCachedScan(event.id, data);
      if (previousScan) {
        showResult({
          status: previousScan.valid ? "duplicate" : "invalid",
          title: previousScan.valid ? "ALREADY SCANNED" : "PREVIOUSLY INVALID",
          message: previousScan.valid
            ? "This ticket was already validated on this device."
            : previousScan.message || "This ticket was previously rejected.",
          speech: previousScan.valid ? "Ticket already scanned" : "Ticket not valid"
        });
        return;
      }

      let validation;
      try {
        validation = await validateTicket(token, event.id, data);
      } catch (validationError) {
        if (!isNetworkError(validationError)) throw validationError;
        showResult({
          status: "offline",
          title: "OFFLINE — NOT VALIDATED",
          message: "This ticket has not been validated. Reconnect and scan it again.",
          speech: "Offline. Ticket not validated"
        });
        return;
      }

      const nextResult = {
        status: validation.valid ? "valid" : "invalid",
        title: validation.valid ? "TICKET VALID" : "TICKET NOT VALID",
        message: validation.message || (
          validation.valid
            ? "Entry approved. This ticket is now saved on this device."
            : "Entry not approved."
        ),
        speech: validation.valid ? "Ticket valid" : "Ticket not valid"
      };

      try {
        await cacheScan(event.id, data, validation);
      } catch (cacheError) {
        nextResult.message += " The result could not be saved for offline duplicate checks.";
      }
      showResult(nextResult);
    } catch (scanError) {
      showResult({
        status: "error",
        title: "SCAN COULD NOT BE VERIFIED",
        message: scanError.message || "Please try again.",
        speech: "Scan could not be verified"
      });
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  }

  return (
    <View style={styles.scannerScreen}>
      <StatusBar barStyle="light-content" />
      {permission?.granted ? (
        <CameraView
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={result || processing ? undefined : handleBarcodeScanned}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View style={styles.cameraFallback} />
      )}

      <View style={styles.scannerOverlay}>
        <View style={styles.scannerHeader}>
          <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
            <Text style={styles.backArrow}>‹</Text>
          </Pressable>
          <View style={styles.scannerHeaderText}>
            <Text style={styles.scannerKicker}>SCANNING FOR</Text>
            <Text numberOfLines={1} style={styles.scannerEventName}>{event.name}</Text>
          </View>
          <View style={styles.readyBadge}><View style={styles.liveDot} /><Text style={styles.readyText}>{processing ? "CHECKING" : "LIVE"}</Text></View>
        </View>

        {!permission ? (
          <View style={styles.permissionPanel}><ActivityIndicator color={COLORS.accent} /></View>
        ) : !permission.granted ? (
          <View style={styles.permissionPanel}>
            <Text style={styles.permissionTitle}>Camera access needed</Text>
            <Text style={styles.permissionCopy}>Allow camera access to scan ticket QR codes at this event.</Text>
            {permission.canAskAgain
              ? <PrimaryButton label="Allow camera" onPress={requestPermission} />
              : <Text style={styles.permissionCopy}>Enable camera access in your device settings to continue.</Text>}
          </View>
        ) : (
          <>
            <View style={styles.viewfinderArea}>
              <View style={styles.viewfinder}>
                <View style={[styles.corner, styles.cornerTopLeft, result && styles[`corner${result.status}`]]} />
                <View style={[styles.corner, styles.cornerTopRight, result && styles[`corner${result.status}`]} />
                <View style={[styles.corner, styles.cornerBottomLeft, result && styles[`corner${result.status}`]} />
                <View style={[styles.corner, styles.cornerBottomRight, result && styles[`corner${result.status}`]} />
                {!result && <View style={styles.scanLine} />}
              </View>
              <Text style={styles.viewfinderHint}>
                {processing ? "Checking ticket…" : result ? "Scan result" : "Align the ticket QR code within the frame"}
              </Text>
            </View>
            <View style={styles.scannerBottom}>
              {processing ? (
                <ActivityIndicator color={COLORS.accent} />
              ) : result ? (
                <>
                  <View
                    accessibilityLiveRegion="assertive"
                    accessibilityRole="alert"
                    style={[styles.resultPanel, styles[`resultPanel${result.status}`]]}
                  >
                    <Text style={[styles.resultTitle, styles[`resultText${result.status}`]}>{result.title}</Text>
                    <Text style={styles.resultMessage}>{result.message}</Text>
                  </View>
                  <PrimaryButton
                    label="Scan next ticket"
                    onPress={() => setResult(null)}
                  />
                </>
              ) : (
                <>
                  <Text style={styles.scanPrompt}>Ready when you are.</Text>
                  <Text style={styles.scanSubprompt}>Hold the code steady — scanning happens automatically.</Text>
                </>
              )}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

export default function App() {
  const [screen, setScreen] = useState("loading");
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      try {
        const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
        if (!active) return;
        if (!storedToken) {
          setScreen("signIn");
          return;
        }

        setToken(storedToken);
        try {
          const assignedEvents = await getAssignedEvents(storedToken);
          let cacheWarning = "";
          try {
            await cacheEvents(assignedEvents);
          } catch (cacheError) {
            cacheWarning = "Assigned events could not be saved for offline use.";
          }
          if (!active) return;
          setEvents(assignedEvents);
          setError(cacheWarning);
          setScreen("events");
        } catch (eventsError) {
          if (!isNetworkError(eventsError)) throw eventsError;
          const cachedEvents = await getCachedEvents();
          if (!active) return;
          if (cachedEvents === null) {
            throw new Error("You're offline and no assigned events are cached on this device.");
          }
          setEvents(cachedEvents);
          setError("Offline: showing assigned events saved on this device.");
          setScreen("events");
        }
      } catch (restoreError) {
        if (!active) return;
        setError(restoreError.message || "Unable to restore your session.");
        setScreen("signIn");
      }
    }

    restoreSession();
    return () => { active = false; };
  }, []);

  async function handleSignIn(email, password) {
    if (!email || !password) {
      setError("Enter your work email and password to continue.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const accessToken = await signIn(email, password);
      const assignedEvents = await getAssignedEvents(accessToken);
      await SecureStore.setItemAsync(TOKEN_KEY, accessToken);
      setToken(accessToken);
      setEvents(assignedEvents);
      try {
        await cacheEvents(assignedEvents);
      } catch (cacheError) {
        setError("Signed in, but assigned events could not be saved for offline use.");
      }
      setScreen("events");
    } catch (signInError) {
      setError(signInError.message || "Unable to sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    setError("");
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch (signOutError) {
      setError(signOutError.message || "Unable to securely sign out.");
      return;
    }

    setToken("");
    setSelectedEvent(null);
    setEvents([]);
    setScreen("signIn");
    try {
      await clearLocalCache();
    } catch (cacheError) {
      setError("Signed out, but local scan data could not be removed from this device.");
    }
  }

  return (
    <View style={styles.flex}>
      <StatusBar barStyle="light-content" />
      {screen === "loading" ? (
        <View style={[styles.screen, styles.loadingScreen]}><ActivityIndicator color={COLORS.accent} /></View>
      ) : screen === "signIn" ? (
        <View style={styles.screen}>
          <SignInScreen onSignIn={handleSignIn} error={error} busy={busy} />
        </View>
      ) : screen === "events" ? (
        <EventsScreen
          events={events}
          error={error}
          onSelect={(event) => { setSelectedEvent(event); setScreen("scanner"); }}
          onSignOut={handleSignOut}
        />
      ) : (
        <ScannerScreen
          event={selectedEvent}
          token={token}
          onBack={() => { setError(""); setScreen("events"); }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: COLORS.background },
  loadingScreen: { alignItems: "center", justifyContent: "center" },
  signInContent: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 26, paddingBottom: 26 },
  brand: { flexDirection: "row", alignItems: "center", gap: 11 },
  brandMark: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.accent },
  brandMarkText: { color: COLORS.black, fontSize: 25, fontWeight: "900", lineHeight: 29 },
  brandName: { color: COLORS.text, fontSize: 17, fontWeight: "800", letterSpacing: -0.5 },
  brandCaption: { color: COLORS.muted, fontSize: 8, fontWeight: "700", letterSpacing: 1.5, marginTop: 3 },
  signInIntro: { marginTop: 74 },
  eyebrow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 18 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.accent },
  eyebrowText: { color: COLORS.accent, fontSize: 10, fontWeight: "800", letterSpacing: 1.6 },
  heading: { color: COLORS.text, fontSize: 36, fontWeight: "700", letterSpacing: -1.3, lineHeight: 42 },
  bodyCopy: { color: COLORS.muted, fontSize: 14, lineHeight: 22, marginTop: 12 },
  form: { marginTop: 38 },
  label: { color: "#B4B8AC", fontSize: 10, fontWeight: "800", letterSpacing: 1.4, marginBottom: 9 },
  passwordLabel: { marginTop: 20 },
  input: { height: 54, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, paddingHorizontal: 16, color: COLORS.text, fontSize: 15 },
  primaryButton: { height: 54, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.accent, marginTop: 24 },
  primaryButtonText: { color: COLORS.black, fontSize: 15, fontWeight: "800" },
  secondaryButton: { backgroundColor: COLORS.surfaceRaised, borderWidth: 1, borderColor: COLORS.border },
  secondaryButtonText: { color: COLORS.text },
  buttonDimmed: { opacity: 0.65 },
  secureNote: { color: COLORS.muted, textAlign: "center", fontSize: 11, marginTop: 17 },
  errorText: { color: COLORS.error, fontSize: 13, lineHeight: 19, marginTop: 13 },
  footer: { color: "#71766A", fontSize: 9, fontWeight: "700", letterSpacing: 1.05, textAlign: "center", marginTop: "auto", paddingTop: 38 },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 24, paddingTop: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  signOutButton: { paddingVertical: 10, paddingHorizontal: 12 },
  signOutText: { color: COLORS.muted, fontSize: 13, fontWeight: "600" },
  eventsContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 38, paddingBottom: 26 },
  sectionKicker: { color: COLORS.accent, fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginBottom: 12 },
  eventList: { gap: 12, marginTop: 28 },
  eventCard: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, borderRadius: 18, padding: 18 },
  cardPressed: { opacity: 0.72 },
  eventCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  eventIcon: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#272E1B" },
  eventIconText: { color: COLORS.accent, fontSize: 20, fontWeight: "700" },
  eventNumber: { color: COLORS.muted, fontSize: 9, fontWeight: "800", letterSpacing: 1.25 },
  eventName: { color: COLORS.text, fontSize: 20, fontWeight: "700", letterSpacing: -0.4, marginBottom: 8 },
  eventMeta: { color: COLORS.muted, fontSize: 12, lineHeight: 19 },
  eventCardBottom: { borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 18, paddingTop: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  eventAction: { color: COLORS.accent, fontSize: 9, fontWeight: "800", letterSpacing: 1.2 },
  eventArrow: { color: COLORS.accent, fontSize: 17 },
  emptyState: { alignItems: "center", paddingHorizontal: 18, paddingVertical: 48, marginTop: 24, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, backgroundColor: COLORS.surface },
  emptyIcon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#272E1B", marginBottom: 16 },
  emptyIconText: { color: COLORS.accent, fontSize: 22 },
  emptyTitle: { color: COLORS.text, fontSize: 16, fontWeight: "700" },
  emptyCopy: { color: COLORS.muted, fontSize: 12, lineHeight: 19, textAlign: "center", marginTop: 8 },
  scannerScreen: { flex: 1, backgroundColor: "#080908" },
  cameraFallback: { ...StyleSheet.absoluteFillObject, backgroundColor: "#080908" },
  scannerOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: "space-between" },
  scannerHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: Platform.OS === "ios" ? 62 : 30, paddingBottom: 20, backgroundColor: "rgba(8,9,8,0.78)" },
  backButton: { width: 40, height: 40, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.11)", alignItems: "center", justifyContent: "center", marginRight: 12 },
  backArrow: { color: COLORS.text, fontSize: 31, lineHeight: 34, marginTop: -4 },
  scannerHeaderText: { flex: 1, marginRight: 10 },
  scannerKicker: { color: COLORS.accent, fontSize: 9, fontWeight: "800", letterSpacing: 1.35 },
  scannerEventName: { color: COLORS.text, fontSize: 14, fontWeight: "700", marginTop: 5 },
  readyBadge: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: "rgba(214,251,84,0.35)", backgroundColor: "rgba(214,251,84,0.12)", borderRadius: 20, paddingHorizontal: 9, paddingVertical: 7 },
  readyText: { color: COLORS.accent, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  viewfinderArea: { alignItems: "center", justifyContent: "center", flex: 1 },
  viewfinder: { width: 256, height: 256, position: "relative" },
  corner: { position: "absolute", width: 31, height: 31, borderColor: COLORS.accent },
  cornerTopLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 12 },
  cornerTopRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 12 },
  cornerBottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 12 },
  cornerBottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 12 },
  scanLine: { height: 2, backgroundColor: COLORS.accent, position: "absolute", left: 16, right: 16, top: "49%", shadowColor: COLORS.accent, shadowOpacity: 0.9, shadowRadius: 9, elevation: 4 },
  viewfinderHint: { color: COLORS.text, fontSize: 13, textAlign: "center", marginTop: 24, paddingHorizontal: 28, textShadowColor: "#000", textShadowRadius: 6 },
  scannerBottom: { alignItems: "center", paddingHorizontal: 26, paddingTop: 24, paddingBottom: Platform.OS === "ios" ? 42 : 26, backgroundColor: "rgba(8,9,8,0.82)" },
  scanPrompt: { color: COLORS.text, fontSize: 18, fontWeight: "700" },
  scanSubprompt: { color: "#B1B4AA", fontSize: 12, textAlign: "center", lineHeight: 19, marginTop: 8 },
  cornervalid: { borderColor: "#B8F28B" },
  cornerinvalid: { borderColor: COLORS.error },
  cornerduplicate: { borderColor: "#FFC857" },
  corneroffline: { borderColor: "#FFC857" },
  cornererror: { borderColor: COLORS.error },
  resultPanel: { width: "100%", borderRadius: 12, borderWidth: 1, padding: 14, alignItems: "center" },
  resultPanelvalid: { borderColor: "#B8F28B", backgroundColor: "rgba(184,242,139,0.12)" },
  resultPanelinvalid: { borderColor: COLORS.error, backgroundColor: "rgba(255,141,128,0.12)" },
  resultPanelduplicate: { borderColor: "#FFC857", backgroundColor: "rgba(255,200,87,0.12)" },
  resultPaneloffline: { borderColor: "#FFC857", backgroundColor: "rgba(255,200,87,0.12)" },
  resultPanelerror: { borderColor: COLORS.error, backgroundColor: "rgba(255,141,128,0.12)" },
  resultTitle: { fontSize: 12, fontWeight: "900", letterSpacing: 1.1, textAlign: "center" },
  resultTextvalid: { color: "#B8F28B" },
  resultTextinvalid: { color: COLORS.error },
  resultTextduplicate: { color: "#FFC857" },
  resultTextoffline: { color: "#FFC857" },
  resultTexterror: { color: COLORS.error },
  resultMessage: { color: COLORS.text, fontSize: 12, lineHeight: 18, marginTop: 7, textAlign: "center" },
  permissionPanel: { alignItems: "center", justifyContent: "center", flex: 1, padding: 30 },
  permissionTitle: { color: COLORS.text, fontSize: 20, fontWeight: "700", textAlign: "center" },
  permissionCopy: { color: "#B1B4AA", fontSize: 13, lineHeight: 20, textAlign: "center", marginTop: 10 }
});
