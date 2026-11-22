import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

// FS-21: access + refresh tokens live only in the OS keychain / keystore (Expo SecureStore).
const KEY = "biletflow_staff_session";
const LEGACY_KEY = "biletflow_admin_access_token";

// SecureStore is unavailable in the browser preview (react-native-web): keep the session in memory there.
const native = Platform.OS === "ios" || Platform.OS === "android";
let memory = null;

export const sessionStore = {
  async load() {
    if (!native) return memory;
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed?.accessToken === "string" ? parsed : null;
    } catch {
      return null;
    }
  },
  async save(session) {
    if (!native) { memory = session; return; }
    await SecureStore.setItemAsync(KEY, JSON.stringify(session));
  },
  async clear() {
    if (!native) { memory = null; return; }
    await SecureStore.deleteItemAsync(KEY);
    await SecureStore.deleteItemAsync(LEGACY_KEY).catch(() => {});
  }
};
