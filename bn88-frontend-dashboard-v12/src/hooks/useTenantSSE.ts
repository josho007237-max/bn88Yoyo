// src/hooks/useTenantSSE.ts
import { useEffect, useRef } from "react";
import { subscribeTenantEvents, type Unsubscribe } from "../lib/events";

export default function useTenantSSE(
  tenant: string | undefined | null,
  onMessage?: (data: any) => void
) {
  const unsubRef = useRef<Unsubscribe | null>(null);

  useEffect(() => {
    // cleanup previous
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }

    if (!tenant) return;

    // legacy-friendly: can pass function directly
    const unsub = subscribeTenantEvents(tenant, onMessage ?? (() => {}));
    unsubRef.current = unsub;

    return () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, [tenant, onMessage]);

  return unsubRef;
}
