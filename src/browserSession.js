// Session storage for the browser version (web services/session.ts equivalent): localStorage survives a page
// reload; when it is blocked (private mode) the session stays in memory. Pure JS, tested.
export function createBrowserSession(key, getStorage = () => globalThis.localStorage) {
  let memory = null;
  return {
    async load() {
      let raw;
      try { raw = getStorage().getItem(key); } catch { return memory; }
      if (!raw) return memory;
      try {
        const parsed = JSON.parse(raw);
        return typeof parsed?.accessToken === "string" ? parsed : null;
      } catch {
        return null;
      }
    },
    async save(session) {
      try {
        getStorage().setItem(key, JSON.stringify(session));
        memory = null;
      } catch {
        memory = session;
      }
    },
    async clear() {
      memory = null;
      try { getStorage().removeItem(key); } catch { /* storage unavailable */ }
    }
  };
}
