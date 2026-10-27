import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_PREFIX = "@biletflow/";
const EVENTS_KEY = `${CACHE_PREFIX}assigned-events`;
const SCAN_KEY_PREFIX = `${CACHE_PREFIX}scans/`;

function scanKey(eventId) {
  return `${SCAN_KEY_PREFIX}${encodeURIComponent(eventId)}`;
}

async function getEventScans(eventId) {
  const serialized = await AsyncStorage.getItem(scanKey(eventId));
  if (serialized === null) return [];

  const scans = JSON.parse(serialized);
  if (!Array.isArray(scans) || scans.some((record) =>
    !record || typeof record.payload !== "string" ||
    typeof record.valid !== "boolean" || typeof record.checkedAt !== "string" ||
    typeof record.message !== "string")) {
    throw new Error("The locally cached scan history is invalid.");
  }

  return scans;
}

export async function getCachedEvents() {
  const serialized = await AsyncStorage.getItem(EVENTS_KEY);
  if (serialized === null) return null;

  const events = JSON.parse(serialized);
  if (!Array.isArray(events) || events.some((event) =>
    !event || typeof event.id !== "string" || typeof event.name !== "string")) {
    throw new Error("The locally cached event list is invalid.");
  }

  return events;
}

export async function cacheEvents(events) {
  await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify(events));
}

export async function getCachedScan(eventId, payload) {
  const scans = await getEventScans(eventId);
  const record = scans.find((scan) => scan.payload === payload);
  if (!record) return null;
  return record;
}

export async function cacheScan(eventId, payload, result) {
  const key = scanKey(eventId);
  const scans = await getEventScans(eventId);
  const record = {
    payload,
    valid: result.valid,
    message: result.message || "",
    checkedAt: new Date().toISOString()
  };
  const existingIndex = scans.findIndex((scan) => scan.payload === payload);
  if (existingIndex < 0) scans.push(record);
  else scans[existingIndex] = record;
  await AsyncStorage.setItem(key, JSON.stringify(scans));
}

export async function clearLocalCache() {
  const keys = await AsyncStorage.getAllKeys();
  const appKeys = keys.filter((key) => key.startsWith(CACHE_PREFIX));
  if (appKeys.length) await AsyncStorage.multiRemove(appKeys);
}
