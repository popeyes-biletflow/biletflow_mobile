import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, Vibration, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Speech from "expo-speech";
import { Button, Card, Notice } from "../components.js";
import { useI18n } from "../i18n.js";
import { SPEECH_LOCALE } from "../strings.js";
import { toneFor } from "../qr.js";
import { colors } from "../theme.js";

const SAME_CODE_COOLDOWN_MS = 3000;

// FS-22: camera scanning with server verification. Every admission is decided by the backend;
// offline or failed requests never show an admission confirmation.
export default function ScannerView({ event, client, active, canUndo, writesAllowed, onScanned, onForbidden, onUndo }) {
  const { t, lang } = useI18n();
  const [permission, requestPermission] = useCameraPermissions();
  const [result, setResult] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const busy = useRef(false); // blocks repeat onBarcodeScanned callbacks while a request is pending
  const lastCode = useRef({ data: "", at: 0 });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; Speech.stop(); };
  }, []);

  function feedback(code) {
    const success = code === "CHECKED_IN";
    try { Vibration.vibrate(success ? 80 : [0, 220, 120, 220]); } catch { /* not supported on web */ }
    Speech.stop();
    const phrase = t(`speech.${code}`);
    Speech.speak(typeof phrase === "string" && !phrase.startsWith("speech.") ? phrase : t("speech.default"), {
      language: SPEECH_LOCALE[lang]
    });
  }

  function show(next) {
    if (!mounted.current) return;
    setResult(next);
    feedback(next.code);
  }

  async function handleScan({ data }) {
    if (!active || busy.current || result) return;
    const now = Date.now();
    // The same code still in front of the camera right after "Scan next" is ignored for a moment.
    if (data === lastCode.current.data && now - lastCode.current.at < SAME_CODE_COOLDOWN_MS) return;
    busy.current = true;
    setProcessing(true);
    const at = new Date();
    try {
      const outcome = await client.verifyTicket(event.id, data);
      onScanned({ ...outcome, at: at.toISOString() });
      show(outcome);
    } catch (error) {
      if (error.code === "NETWORK") {
        onScanned({ code: "OFFLINE", ticketId: null, latencyMs: null, at: at.toISOString() });
        show({ code: "OFFLINE", ticketId: null, latencyMs: null });
      } else if (error.code === "FORBIDDEN") {
        show({ code: "FORBIDDEN", ticketId: null, latencyMs: null, message: error.detail });
        onForbidden(error);
      } else if (error.code !== "SESSION_EXPIRED") {
        show({ code: "ERROR", ticketId: null, latencyMs: null, message: error.message });
      }
    } finally {
      lastCode.current = { data, at: Date.now() };
      busy.current = false;
      if (mounted.current) setProcessing(false);
    }
  }

  function next() {
    lastCode.current = { ...lastCode.current, at: Date.now() };
    setResult(null);
  }

  async function undo() {
    if (!result?.ticketId) return;
    setUndoing(true);
    const ok = await onUndo(result.ticketId);
    if (mounted.current) {
      setUndoing(false);
      if (ok) show({ code: "REVERSED", ticketId: result.ticketId, latencyMs: null });
    }
  }

  if (!permission) {
    return <View style={st.center}><ActivityIndicator color={colors.blue600} /></View>;
  }

  if (!permission.granted) {
    return (
      <ScrollView contentContainerStyle={st.pad}>
        <Card style={st.permission}>
          <Text accessibilityRole="header" style={st.permissionTitle}>{t("scanner.permissionTitle")}</Text>
          <Text style={st.permissionBody}>{permission.canAskAgain ? t("scanner.permissionBody") : t("scanner.permissionSettings")}</Text>
          {permission.canAskAgain
            ? <Button label={t("scanner.permissionAllow")} onPress={requestPermission} />
            : <Button variant="outline" label={t("scanner.openSettings")} onPress={() => Linking.openSettings().catch(() => {})} />}
        </Card>
      </ScrollView>
    );
  }

  const tone = result ? toneFor(result.code) : null;
  const frameColor = !result ? colors.white
    : tone === "success" ? colors.emerald500 : tone === "warning" ? colors.amber500 : tone === "info" ? colors.blue500 : colors.red500;
  const copy = result ? t(`result.${result.code}`) : null;
  const title = copy && typeof copy === "object" ? copy.title : t("result.INVALID.title");
  const body = copy && typeof copy === "object" ? copy.body : t("result.INVALID.body");

  return (
    <ScrollView contentContainerStyle={st.pad} keyboardShouldPersistTaps="handled">
      <View style={st.cameraBox}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          active={active}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={active && !result && !processing ? handleScan : undefined}
        />
        <View pointerEvents="none" style={st.frameWrap}>
          <View style={st.frame}>
            <View style={[st.corner, st.tl, { borderColor: frameColor }]} />
            <View style={[st.corner, st.tr, { borderColor: frameColor }]} />
            <View style={[st.corner, st.bl, { borderColor: frameColor }]} />
            <View style={[st.corner, st.br, { borderColor: frameColor }]} />
          </View>
        </View>
        {processing ? (
          <View style={st.processing}>
            <ActivityIndicator color={colors.white} />
            <Text style={st.processingText}>{t("scanner.checking")}</Text>
          </View>
        ) : null}
      </View>

      {!active ? <Notice tone="warning" style={st.gap}>{t("scanner.disabled")}</Notice> : null}

      {result ? (
        <View style={st.gap}>
          <Notice tone={tone} role="alert" title={title}>
            <Text style={[st.resultBody, { color: tone === "success" ? colors.emerald800 : tone === "warning" ? colors.amber800 : tone === "info" ? colors.blue700 : colors.red700 }]}>
              {body}
            </Text>
            {result.ticketId ? <Text selectable style={st.resultMeta}>{t("scanner.ticket", { id: result.ticketId })}</Text> : null}
            {result.latencyMs != null ? <Text style={st.resultMeta}>{t("scanner.latency", { ms: result.latencyMs })}</Text> : null}
            {result.message && ["ERROR", "INVALID", "FORBIDDEN"].includes(result.code) ? <Text style={st.resultMeta}>{result.message}</Text> : null}
          </Notice>
          <View style={st.actions}>
            {result.code === "CHECKED_IN" && result.ticketId && canUndo ? (
              <Button variant="danger" label={t("scanner.undo")} loading={undoing} disabled={!writesAllowed} onPress={undo} />
            ) : null}
            <Button label={t("scanner.next")} disabled={undoing} onPress={next} />
          </View>
        </View>
      ) : !processing ? (
        <View style={st.ready}>
          <Text style={st.readyTitle}>{t("scanner.ready")}</Text>
          <Text style={st.readyHint}>{t("scanner.readyHint")}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  pad: { padding: 16, paddingBottom: 32 },
  gap: { marginTop: 16 },
  permission: { padding: 20, gap: 12 },
  permissionTitle: { fontSize: 18, fontWeight: "700", color: colors.gray800 },
  permissionBody: { fontSize: 14, lineHeight: 20, color: colors.gray600 },
  cameraBox: { width: "100%", aspectRatio: 1, maxHeight: 420, borderRadius: 12, overflow: "hidden", backgroundColor: colors.gray900, alignSelf: "center" },
  frameWrap: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  frame: { width: "62%", aspectRatio: 1 },
  corner: { position: "absolute", width: 34, height: 34 },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 10 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 10 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 10 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 10 },
  processing: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(17,24,39,0.55)", alignItems: "center", justifyContent: "center", gap: 10 },
  processingText: { color: colors.white, fontSize: 15, fontWeight: "600" },
  resultBody: { fontSize: 14, lineHeight: 20 },
  resultMeta: { marginTop: 6, fontSize: 13, color: colors.gray600 },
  actions: { marginTop: 12, gap: 10 },
  ready: { marginTop: 16, alignItems: "center", paddingHorizontal: 8 },
  readyTitle: { fontSize: 16, fontWeight: "700", color: colors.gray800, textAlign: "center" },
  readyHint: { marginTop: 6, fontSize: 14, lineHeight: 20, color: colors.gray500, textAlign: "center" }
});
