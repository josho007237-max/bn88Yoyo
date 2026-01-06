import { useEffect } from "react";
import connectEvents from "../lib/events";

export function useTenantSSE(tenant: string, handlers?: any) {
  useEffect(() => {
    if (!tenant) return;
    const disconnect = connectEvents({ tenant, ...(handlers || {}) });
    return () => disconnect();
  }, [tenant, handlers]);
}

export default useTenantSSE;
