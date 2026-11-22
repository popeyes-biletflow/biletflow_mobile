import AsyncStorage from "@react-native-async-storage/async-storage";

// User-specific, non-secret cache. Cleared on sign-out and when another account signs in (FS-21).
// Attendee rosters and QR payloads are never written to disk.
const CACHE_PREFIX = "@biletflow/";
const EVENTS_KEY = `${CACHE_PREFIX}assigned-events`;

/** @returns {Promise<{ user: object, events: object[] } | null>} */
export async function getCachedEvents(userId) {
  const serialized = await AsyncStorage.getItem(EVENTS_KEY);
  if (serialized === null) return null;
  try {
    const parsed = JSON.parse(serialized);
    if (!parsed?.user || parsed.user.id !== userId || !Array.isArray(parsed.events)) return null;
    return {
      user: parsed.user,
      events: parsed.events.filter((event) => event && typeof event.id === "string" && typeof event.name === "string")
    };
  } catch {
    return null;
  }
}

export async function cacheEvents(profile, events) {
  const user = { id: profile.id, email: profile.email, full_name: profile.full_name || "", role: profile.role };
  await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify({ user, events, savedAt: new Date().toISOString() }));
}

export async function clearLocalCache() {
  const keys = await AsyncStorage.getAllKeys();
  const appKeys = keys.filter((key) => key.startsWith(CACHE_PREFIX));
  if (appKeys.length) await AsyncStorage.multiRemove(appKeys);
}
