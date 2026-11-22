import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createClient, isStaffRole } from "./api.js";
import { getApiBaseUrl } from "./apiConfig.js";
import { clearLocalCache } from "./localCache.js";
import { sessionStore } from "./sessionStore.js";

const AuthContext = createContext(null);

// Session for the whole app (web AuthContext equivalent): any role can sign in; the token lives in
// SecureStore, a 401 refreshes once, a failed refresh signs out with "session expired".
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [configError, setConfigError] = useState("");
  const [offline, setOffline] = useState(false);
  const userRef = useRef(null);

  const clearUser = useCallback(() => {
    userRef.current = null;
    setUser(null);
    clearLocalCache().catch(() => {});
  }, []);

  const client = useMemo(() => createClient({
    baseUrl: getApiBaseUrl,
    store: sessionStore,
    onSessionExpired: () => { clearUser(); setSessionExpired(true); }
  }), [clearUser]);

  useEffect(() => {
    let active = true;
    (async () => {
      try { getApiBaseUrl(); } catch (error) { setConfigError(error.message); setReady(true); return; }
      try {
        const profile = await client.restore();
        if (!active) return;
        if (profile) { userRef.current = profile; setUser(profile); }
      } catch (error) {
        if (error.code === "NETWORK") {
          // keep the stored session; screens show their own offline states
          const stored = await sessionStore.load().catch(() => null);
          if (stored?.userId && active) {
            const fallback = { id: stored.userId, email: stored.email, role: "attendee", full_name: "" };
            userRef.current = fallback;
            setUser(fallback);
            setOffline(true);
          }
        }
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => { active = false; };
  }, [client]);

  const signIn = useCallback(async (email, password) => {
    const profile = await client.signIn(email, password);
    await clearLocalCache().catch(() => {}); // nothing from a previous account survives
    userRef.current = profile;
    setUser(profile);
    setSessionExpired(false);
    setOffline(false);
    return profile;
  }, [client]);

  const signOut = useCallback(async () => {
    await client.signOut().catch(() => {});
    clearUser();
    setSessionExpired(false);
  }, [client, clearUser]);

  const refreshProfile = useCallback(async () => {
    const profile = await client.getProfile();
    userRef.current = profile;
    setUser(profile);
    setOffline(false);
    return profile;
  }, [client]);

  const applyProfile = useCallback((profile) => {
    const next = { ...userRef.current, ...profile };
    userRef.current = next;
    setUser(next);
  }, []);

  const value = useMemo(() => ({
    client, user, ready, sessionExpired, configError, offline,
    isStaff: !!user && isStaffRole(user.role),
    isOrganizer: user?.role === "organizer",
    signIn, signOut, refreshProfile, applyProfile,
    dismissExpired: () => setSessionExpired(false)
  }), [client, user, ready, sessionExpired, configError, offline, signIn, signOut, refreshProfile, applyProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
