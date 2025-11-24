// src/hooks/useTenantSSE.ts
import { useEffect } from "react";

export function useTenantSSE(tenant: string, onEvent: (ev: { type: string; payload: any }) => void) {
  useEffect(() => {
    const es = new EventSource(`/api/live/${tenant}`);
    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      onEvent(data);
    };
    es.onerror = () => {
      console.warn("SSE error, will auto-reconnect");
    };
    return () => es.close();
  }, [tenant, onEvent]);
}