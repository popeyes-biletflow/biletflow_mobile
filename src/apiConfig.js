// FS-21: one release configuration — the shared FastAPI origin.
// The app always talks to the authenticated staff/assignment API (/api/mobile/*).

function isPrivateHost(host) {
  if (host === "localhost" || host === "[::1]") return true;
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || !parts.every((p) => Number.isInteger(p) && p >= 0 && p <= 255)) return false;
  return parts[0] === 127 || parts[0] === 10 || (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31);
}

export function validateApiUrl(raw, { development = false } = {}) {
  const value = typeof raw === "string" ? raw.trim().replace(/\/+$/, "") : "";
  if (!value) throw new Error("Set EXPO_PUBLIC_API_URL to the BiletFlow backend URL.");
  let url;
  try { url = new URL(value); } catch { throw new Error("EXPO_PUBLIC_API_URL must be a valid backend URL."); }
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("Use the backend origin only, without credentials, paths, query parameters, or fragments.");
  }
  if (url.hostname.endsWith(".supabase.co")) {
    throw new Error("Use the BiletFlow FastAPI backend URL, not the Supabase project URL.");
  }
  if (url.protocol !== "https:" && !(development && url.protocol === "http:" && isPrivateHost(url.hostname))) {
    throw new Error("The API must use HTTPS. Local HTTP is allowed only in development on a private network.");
  }
  return value;
}

export function getApiBaseUrl() {
  const development = typeof __DEV__ !== "undefined" && __DEV__;
  return validateApiUrl(process.env.EXPO_PUBLIC_API_URL, { development });
}

// Optional: the web app origin, used for the "Forgot password?" link.
export function getWebUrl() {
  const value = process.env.EXPO_PUBLIC_WEB_URL?.trim().replace(/\/+$/, "");
  if (!value) return null;
  try { return new URL(value).protocol.startsWith("http") ? value : null; } catch { return null; }
}
