// "web" matches the inspected biletflow_web backend. "mobile" requires the
// extended, event-authorized contract documented in README.md.
export const API_MODE = process.env.EXPO_PUBLIC_API_MODE || "web";
export const API_CAPABILITIES = Object.freeze({
  assignedEvents: API_MODE === "mobile",
  attendeeOperations: API_MODE === "mobile"
});

export function getApiBaseUrl() {
  if (!["web", "mobile"].includes(API_MODE)) {
    throw new Error("EXPO_PUBLIC_API_MODE must be web or mobile.");
  }
  const value = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, "");
  if (!value) throw new Error("Set EXPO_PUBLIC_API_URL to the BiletFlow backend URL.");
  let url;
  try { url = new URL(value); } catch { throw new Error("EXPO_PUBLIC_API_URL must be a valid backend URL."); }
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("Use the backend origin only, without credentials, paths, query parameters, or fragments.");
  }
  if (url.hostname.endsWith(".supabase.co")) {
    throw new Error("Use the BiletFlow FastAPI backend URL, not the Supabase project URL.");
  }
  const host = url.hostname;
  const parts = host.split(".").map(Number);
  const privateHost = host === "localhost" || host === "[::1]" ||
    (parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) &&
      (parts[0] === 127 || parts[0] === 10 || (parts[0] === 192 && parts[1] === 168) ||
        (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)));
  const development = typeof __DEV__ !== "undefined" && __DEV__;
  if (url.protocol !== "https:" && !(development && url.protocol === "http:" && privateHost)) {
    throw new Error("The API must use HTTPS. Local HTTP is allowed only in development on a private network.");
  }
  return value;
}
