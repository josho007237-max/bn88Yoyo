import { useEffect } from "react";

export function useSSE(tenant: string, onEvent: (e:any)=>void) {
  useEffect(() => {
    const es = new EventSource(`/api/live/${encodeURIComponent(tenant)}`);
    es.onmessage = (ev) => {
      try { onEvent(JSON.parse(ev.data)); } catch {}
    };
    es.addEventListener("ping", () => {});
    es.onerror = () => { /* อาจโชว์ badge: Reconnecting... */ };
    return () => es.close();
  }, [tenant, onEvent]);
}
