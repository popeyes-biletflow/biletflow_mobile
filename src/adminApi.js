const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, "");

async function request(path, { token, ...options } = {}) {
  if (!API_BASE_URL) {
    throw new Error("Set EXPO_PUBLIC_API_URL before signing in.");
  }
  if (!API_BASE_URL.startsWith("https://")) {
    throw new Error("The admin API must use HTTPS.");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  const text = await response.text();
  let body;

  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = {};
  }

  if (!response.ok) {
    throw new Error(body.message || body.error || `Request failed (${response.status}).`);
  }

  return body;
}

export async function signIn(email, password) {
  const result = await request("/api/mobile/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });

  if (typeof result.accessToken !== "string" || !result.accessToken) {
    throw new Error("The sign-in response did not include an access token.");
  }

  return result.accessToken;
}

export async function getAssignedEvents(token) {
  const result = await request("/api/mobile/events", { token });

  if (!Array.isArray(result.events)) {
    throw new Error("The assigned-events response is invalid.");
  }

  return result.events.map((event) => {
    if (!event || (typeof event.id !== "string" && typeof event.id !== "number") ||
        typeof event.name !== "string") {
      throw new Error("An assigned event is missing its required ID or name.");
    }

    return {
      id: String(event.id),
      name: event.name,
      venue: typeof event.venue === "string" ? event.venue : "",
      startsAt: typeof event.startsAt === "string" ? event.startsAt : ""
    };
  });
}
