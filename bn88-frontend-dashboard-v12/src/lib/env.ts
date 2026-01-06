export function getApiBase(): string {
  return String(import.meta.env.VITE_API_BASE || "/api").replace(/\/+$/, "");
}

export function getEventsUrl(tenant: string): string {
  const base = getApiBase();
  return `${base}/live/${encodeURIComponent(tenant)}`;
}
