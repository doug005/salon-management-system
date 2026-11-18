const base = __PUBLIC_CONFIG__.apiUrl || "/api";
let token = null,
  refreshing;
export function acceptSession(session) {
  token = session?.token || null;
  window.dispatchEvent(new CustomEvent("salon-session", { detail: session }));
}
export async function refresh() {
  if (!refreshing)
    refreshing = fetch(`${base}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const session = await response.json();
        acceptSession(session);
        return session;
      })
      .finally(() => {
        refreshing = null;
      });
  return refreshing;
}
export async function request(path, options = {}, retry = true) {
  const response = await fetch(base + path, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    body:
      options.rawBody ||
      (options.body ? JSON.stringify(options.body) : undefined),
  });
  if (response.status === 401 && retry && !path.startsWith("/auth/")) {
    if (await refresh()) return request(path, options, false);
    acceptSession(null);
  }
  if (response.status === 204) return null;
  const data = await response
    .json()
    .catch(() => ({
      message:
        response.status === 429
          ? "Too many attempts. Please wait before trying again."
          : "The API is temporarily unavailable. Please try again later.",
    }));
  if (!response.ok)
    throw new Error(
      data.errors?.map((e) => `${e.field}: ${e.message}`).join(" ") ||
        data.message ||
        "Request failed.",
    );
  return data;
}
export async function logout() {
  await request("/auth/logout", { method: "POST" });
  acceptSession(null);
}
export const money = (lisente) =>
  `M ${(lisente / 100).toLocaleString("en-LS", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const dateTime = (value) =>
  new Intl.DateTimeFormat("en-LS", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Maseru",
  }).format(new Date(value));

export const mediaUrl = (path) =>
  /^https?:\/\//i.test(path || "") ? path : base.replace(/\/api\/?$/, "") + path;
