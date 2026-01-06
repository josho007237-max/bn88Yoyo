// src/lib/events.ts
// SSE helpers (EventSource) — ALWAYS returns Unsubscribe() function

export type Unsubscribe = () => void;

export type EventsHandlers = {
  onOpen?: (ev: Event) => void;
  onError?: (ev: Event) => void;

  // optional
  onMessage?: (data: any, raw: MessageEvent) => void;

  // optional router
  onEvent?: (eventName: string, data: any, raw: MessageEvent) => void;

  // legacy handlers used in pages
  onHello?: (data: any) => void;
  onPing?: (data: any) => void;
  onCaseNew?: (data: any) => void;
  onStatsUpdate?: (data: any) => void;
};

export type ConnectEventsOptions = {
  tenant: string;
  baseUrl?: string;
  endpoint?: string; // default /api/events
  token?: string; // query token (EventSource can't set headers)
  query?: Record<string, string | number | boolean | null | undefined>;
  handlers?: EventsHandlers;
};

// Legacy: allow connectEvents({ tenant, onPing, onCaseNew, ... })
export type LegacyConnectEventsOptions = {
  tenant: string;
  baseUrl?: string;
  endpoint?: string;
  token?: string;
  query?: Record<string, string | number | boolean | null | undefined>;
} & EventsHandlers;

type ConnectInput = ConnectEventsOptions | LegacyConnectEventsOptions;

function getApiBase(): string {
  const v = (import.meta as any)?.env?.VITE_API_BASE as string | undefined;
  const base = (v ?? "").trim();
  return base.replace(/\/+$/, "");
}

function getAuthTokenFromStorage(): string | undefined {
  const keys = ["auth_token", "token", "access_token", "AUTH_TOKEN"];
  for (const k of keys) {
    const v = localStorage.getItem(k);
    if (v && v.trim()) return v.trim();
  }
  return undefined;
}

function safeParse(data: any): any {
  if (data == null) return data;
  if (typeof data !== "string") return data;
  const s = data.trim();
  if (!s) return s;
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

function normalize(input: ConnectInput): {
  tenant: string;
  baseUrl?: string;
  endpoint: string;
  token?: string;
  query?: Record<string, string | number | boolean | null | undefined>;
  handlers: EventsHandlers;
} {
  const anyInput = input as any;

  const tenant: string = anyInput.tenant;
  const baseUrl: string | undefined = anyInput.baseUrl;
  const endpoint: string = (anyInput.endpoint ?? "/api/live").trim();
  const token: string | undefined = anyInput.token;
  const query = anyInput.query;

  const handlers: EventsHandlers = anyInput.handlers
    ? (anyInput.handlers as EventsHandlers)
    : ({
        onOpen: anyInput.onOpen,
        onError: anyInput.onError,
        onMessage: anyInput.onMessage,
        onEvent: anyInput.onEvent,

        onHello: anyInput.onHello,
        onPing: anyInput.onPing,
        onCaseNew: anyInput.onCaseNew,
        onStatsUpdate: anyInput.onStatsUpdate,
      } as EventsHandlers);

  return { tenant, baseUrl, endpoint, token, query, handlers };
}

function buildUrl(n: ReturnType<typeof normalize>): string {
  const base = (n.baseUrl ?? getApiBase()).replace(/\/+$/, "");
  const endpoint = n.endpoint;

  const url = new URL(
    base
      ? `${base}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`
      : endpoint,
    window.location.origin
  );

  const t = encodeURIComponent(n.tenant);
  url.pathname = url.pathname.replace(/\/+$/, "") + "/" + t;

  const token = n.token ?? getAuthTokenFromStorage();
  if (token) url.searchParams.set("token", token);

  const q = n.query ?? {};
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null) continue;
    url.searchParams.set(k, String(v));
  }

  return url.toString();
}

function normalizeEventName(name: string): string {
  return String(name || "")
    .trim()
    .toLowerCase();
}

function pickEventName(parsed: any): string {
  if (parsed == null) return "";
  if (typeof parsed === "string") return parsed;
  if (typeof parsed === "object") {
    return (parsed.type ?? parsed.event ?? parsed.name ?? "") as string;
  }
  return "";
}

/**
 * Default export
 * - Accepts BOTH:
 *   1) connectEvents({ tenant, handlers: {...} })
 *   2) connectEvents({ tenant, onPing, onCaseNew, ... }) (legacy)
 * - Returns: unsubscribe()
 */
export default function connectEvents(input: ConnectInput): Unsubscribe {
  const n = normalize(input);
  const url = buildUrl(n);
  const h = n.handlers;

  const es = new EventSource(url);

  es.onopen = (ev) => h.onOpen?.(ev);
  es.onerror = (ev) => h.onError?.(ev);

  es.onmessage = (raw) => {
    const parsed = safeParse(raw.data);

    // keep full payload for generic consumers
    h.onMessage?.(parsed, raw);

    const evNameRaw = pickEventName(parsed);
    const evName = normalizeEventName(evNameRaw);

    if (!evName) return;

    // pass "data" to specific handlers (pages expect e.botId etc.)
    const payload =
      parsed && typeof parsed === "object" && "data" in parsed
        ? (parsed as any).data
        : parsed;

    h.onEvent?.(evNameRaw, parsed, raw);

    if (evName === "hello") h.onHello?.(payload);
    if (evName === "ping" || evName === "hb" || evName === "heartbeat")
      h.onPing?.(payload);

    // case events (support multiple spellings)
    if (evName === "case:new" || evName === "case_new" || evName === "casenew")
      h.onCaseNew?.(payload);

    // stats events
    if (
      evName === "stats:update" ||
      evName === "stats_update" ||
      evName === "statsupdate"
    )
      h.onStatsUpdate?.(payload);
  };

  return () => {
    try {
      es.close();
    } catch {
      // ignore
    }
  };
}

/**
 * Named export: subscribeTenantEvents(tenant, ...)
 * Accepts BOTH:
 * - subscribeTenantEvents(tenant, { onMessage, ... })
 * - subscribeTenantEvents(tenant, (data) => { ... })   (legacy)
 */
export function subscribeTenantEvents(
  tenant: string,
  handlersOrOnMessage?: EventsHandlers | ((data: any) => void),
  extra?: {
    baseUrl?: string;
    endpoint?: string;
    token?: string;
    query?: Record<string, string | number | boolean | null | undefined>;
  }
): Unsubscribe {
  const handlers: EventsHandlers =
    typeof handlersOrOnMessage === "function"
      ? { onMessage: (data) => handlersOrOnMessage(data) }
      : (handlersOrOnMessage ?? {});

  return connectEvents({
    tenant,
    baseUrl: extra?.baseUrl,
    endpoint: extra?.endpoint,
    token: extra?.token,
    query: extra?.query,
    handlers,
  });
}
