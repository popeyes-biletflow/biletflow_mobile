import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createBrowserSession } from "./browserSession.js";

// FS-21: on a phone, access + refresh tokens live only in the OS keychain / keystore (Expo SecureStore).
const KEY = "biletflow_staff_session";
const LEGACY_KEY = "biletflow_admin_access_token";

const nativeSession = {
  async load() {
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
    await SecureStore.setItemAsync(KEY, JSON.stringify(session));
  },
  async clear() {
    await SecureStore.deleteItemAsync(KEY);
    await SecureStore.deleteItemAsync(LEGACY_KEY).catch(() => {});
  }
};

// SecureStore is unavailable in the browser (react-native-web): use localStorage there, like biletflow_web.
const native = Platform.OS === "ios" || Platform.OS === "android";
export const sessionStore = native ? nativeSession : createBrowserSession(KEY);
