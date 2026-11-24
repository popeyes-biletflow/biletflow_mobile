// biletflow_web EventCarousel: featured events one by one, cross-fade, 4.5 s autoplay, arrows, dots,
// play/pause and swipe. Touch pauses autoplay (web: hover/focus/touch); it also stops while the
// screen is in the background.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Image, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "./i18n.js";
import { categoryKey } from "./models.js";
import { colors, shadow } from "./theme.js";

const AUTOPLAY_MS = 4500;
const FADE_MS = 700;
const SWIPE_PX = 50;
const GRAY_950 = "#030712";

export default function EventCarousel({ events, onOpen }) {
  const { t, formatDate, formatKZT } = useI18n();
  const focused = useIsFocused();
  const total = events.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false); // play/pause button
  const [touching, setTouching] = useState(false); // finger on the carousel
  const [reduceMotion, setReduceMotion] = useState(false);
  const opacities = useRef(new Map()).current;

  const current = Math.min(index, Math.max(0, total - 1));
  const next = useCallback(() => { if (total > 1) setIndex((i) => (Math.min(i, total - 1) + 1) % total); }, [total]);
  const prev = useCallback(() => { if (total > 1) setIndex((i) => (Math.min(i, total - 1) - 1 + total) % total); }, [total]);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.("reduceMotionChanged", setReduceMotion);
    return () => sub?.remove?.();
  }, []);

  // autoplay
  useEffect(() => {
    if (paused || touching || !focused || total <= 1) return undefined;
    const timer = setInterval(next, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [paused, touching, focused, total, next]);

  const opacityFor = (id, active) => {
    if (!opacities.has(id)) opacities.set(id, new Animated.Value(active ? 1 : 0));
    return opacities.get(id);
  };

  // cross-fade (web: transition-opacity duration-700 ease-out)
  useEffect(() => {
    events.forEach((e, i) => {
      Animated.timing(opacityFor(e.id, i === current), {
        toValue: i === current ? 1 : 0, duration: reduceMotion ? 0 : FADE_MS, useNativeDriver: true
      }).start();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, events, reduceMotion]);

  // horizontal swipe; vertical drags stay with the list
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderTerminationRequest: () => true,
    onPanResponderRelease: (_, g) => {
      if (g.dx < -SWIPE_PX) next();
      else if (g.dx > SWIPE_PX) prev();
    }
  }), [next, prev]);

  if (total === 0) return null;

  return (
    <View
      accessibilityLabel={t("carousel.featured")}
      onTouchStart={() => setTouching(true)}
      onTouchEnd={() => setTouching(false)}
      onTouchCancel={() => setTouching(false)}
      style={st.root}
      {...pan.panHandlers}
    >
      {events.map((event, i) => {
        const active = i === current;
        const minPrice = event.ticketTiers?.length ? Math.min(...event.ticketTiers.map((x) => x.priceKZT)) : null;
        return (
          <Animated.View key={event.id} pointerEvents={active ? "auto" : "none"}
            accessibilityElementsHidden={!active} importantForAccessibility={active ? "auto" : "no-hide-descendants"}
            style={[StyleSheet.absoluteFill, { opacity: opacityFor(event.id, active), zIndex: active ? 1 : 0 }]}>
            {event.imageUrl
              ? <Image source={{ uri: event.imageUrl }} style={st.image} resizeMode="cover" accessibilityIgnoresInvertColors />
              : <Fallback />}
            <Vignette />

            <View style={st.content}>
              <View style={st.chips}>
                <Text style={[st.chip, st.chipCategory]}>{t(`categories.${categoryKey(event.category)}`, { defaultValue: event.category })}</Text>
                <Text style={[st.chip, st.chipDate]}>📅 {formatDate(event.startsAt, event.timezone, "card")}</Text>
                {minPrice !== null ? (
                  <Text style={[st.chip, st.chipPrice]}>
                    {minPrice > 0 ? t("carousel.from", { price: formatKZT(minPrice) }) : t("carousel.free")}
                  </Text>
                ) : null}
              </View>
              <Text accessibilityRole="header" numberOfLines={3} style={st.title}>{event.title}</Text>
              <Text numberOfLines={2} style={st.venue}>
                <Text style={st.pin}>📍</Text> {[event.venueName, event.venueAddress].filter(Boolean).join(" · ")}
              </Text>
              {event.description ? <Text numberOfLines={2} style={st.description}>{event.description}</Text> : null}
              <Pressable accessibilityRole="link" onPress={() => onOpen(event)}
                style={({ pressed }) => [st.cta, pressed && st.ctaPressed]}>
                <Text style={st.ctaText}>{t("carousel.viewEvent")}</Text>
                <Text style={st.ctaText} accessibilityElementsHidden importantForAccessibility="no">→</Text>
              </Pressable>
            </View>
          </Animated.View>
        );
      })}

      {total > 1 ? (
        <>
          <Pressable accessibilityRole="button" accessibilityLabel={t("carousel.previous")} onPress={prev} hitSlop={6}
            style={({ pressed }) => [st.arrow, st.arrowLeft, pressed && st.arrowPressed]}>
            <Ionicons name="chevron-back" size={22} color={colors.white} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t("carousel.next")} onPress={next} hitSlop={6}
            style={({ pressed }) => [st.arrow, st.arrowRight, pressed && st.arrowPressed]}>
            <Ionicons name="chevron-forward" size={22} color={colors.white} />
          </Pressable>
        </>
      ) : null}

      <View style={st.controls}>
        <Pressable accessibilityRole="button" accessibilityLabel={paused ? t("carousel.play") : t("carousel.pause")}
          onPress={() => setPaused((p) => !p)} hitSlop={8} style={st.playPause}>
          <Ionicons name={paused ? "play" : "pause"} size={13} color="rgba(255,255,255,0.85)" />
        </Pressable>
        <View style={st.dots}>
          {events.map((e, i) => (
            <Pressable key={e.id} accessibilityRole="button" accessibilityState={{ selected: i === current }}
              accessibilityLabel={t("carousel.slideOf", { current: i + 1, total })}
              onPress={() => setIndex(i)} hitSlop={{ top: 10, bottom: 10, left: 3, right: 3 }}
              style={[st.dot, i === current ? st.dotActive : st.dotIdle]} />
          ))}
        </View>
      </View>
    </View>
  );
}

// bg-gradient-to-br from-indigo-950 via-slate-900 to-blue-950
function Fallback() {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <LinearGradient id="fallback" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#1e1b4b" />
          <Stop offset="0.5" stopColor="#0f172a" />
          <Stop offset="1" stopColor="#172554" />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#fallback)" />
    </Svg>
  );
}

// from-gray-950 via-gray-950/60 to-transparent (bottom-up) + from-gray-950/90 via-gray-950/40 (left-right)
function Vignette() {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
      <Defs>
        <LinearGradient id="up" x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor={GRAY_950} stopOpacity="1" />
          <Stop offset="0.5" stopColor={GRAY_950} stopOpacity="0.6" />
          <Stop offset="1" stopColor={GRAY_950} stopOpacity="0" />
        </LinearGradient>
        <LinearGradient id="side" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={GRAY_950} stopOpacity="0.9" />
          <Stop offset="0.5" stopColor={GRAY_950} stopOpacity="0.4" />
          <Stop offset="1" stopColor={GRAY_950} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#up)" />
      <Rect width="100%" height="100%" fill="url(#side)" />
    </Svg>
  );
}

const st = StyleSheet.create({
  // relative mb-8 overflow-hidden rounded-2xl bg-gray-950 shadow-xl, min-h-[360px] on small screens
  root: { height: 380, marginBottom: 32, borderRadius: 16, overflow: "hidden", backgroundColor: GRAY_950, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", ...shadow.md },
  image: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%", transform: [{ scale: 1.05 }] },
  content: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 52, zIndex: 2 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip: { overflow: "hidden", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, fontSize: 12, color: colors.white },
  chipCategory: { backgroundColor: "rgba(37,99,235,0.9)", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8 },
  chipDate: { backgroundColor: "rgba(255,255,255,0.2)", fontWeight: "500" },
  chipPrice: { backgroundColor: "rgba(16,185,129,0.9)", fontWeight: "700" },
  title: { fontSize: 24, lineHeight: 29, fontWeight: "900", color: colors.white, letterSpacing: -0.4, textShadowColor: "rgba(0,0,0,0.35)", textShadowRadius: 4, textShadowOffset: { width: 0, height: 2 } },
  venue: { marginTop: 8, fontSize: 12, color: colors.gray300 },
  pin: { color: "#60a5fa" },
  description: { marginTop: 8, fontSize: 12, lineHeight: 17, color: "rgba(209,213,219,0.9)" },
  cta: { marginTop: 16, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, backgroundColor: colors.blue600, paddingHorizontal: 20, paddingVertical: 11, ...shadow.md },
  ctaPressed: { backgroundColor: colors.blue500 },
  ctaText: { fontSize: 14, fontWeight: "700", color: colors.white },
  // web centres the arrows vertically; on a phone-width card that covers the title, so they sit at the top
  arrow: { position: "absolute", top: 14, width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.4)", zIndex: 3 },
  arrowLeft: { left: 12 },
  arrowRight: { right: 12 },
  arrowPressed: { backgroundColor: "rgba(0,0,0,0.7)" },
  controls: { position: "absolute", right: 16, bottom: 16, flexDirection: "row", alignItems: "center", gap: 8, zIndex: 3 },
  playPause: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)" },
  dots: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.4)", paddingHorizontal: 10, paddingVertical: 6 },
  dot: { height: 8, borderRadius: 4 },
  dotActive: { width: 24, backgroundColor: colors.blue500 },
  dotIdle: { width: 8, backgroundColor: "rgba(255,255,255,0.4)" }
});
