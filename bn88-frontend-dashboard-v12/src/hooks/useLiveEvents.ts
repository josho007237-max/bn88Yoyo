// src/hooks/useLiveEvents.ts
import { useEffect } from "react";

const TENANT = import.meta.env.VITE_TENANT || "bn9";

export type LiveEvent =
  | {
      type: "case:new";
      tenant: string;
      botId: string;
      case: {
        id: string;
        text?: string | null;
        kind?: string | null;
        createdAt?: string | Date;
      };
    }
  | {
      type: "stats:update";
      tenant: string;
      botId: string;
      dateKey: string;
      delta: { total?: number; text?: number; follow?: number; unfollow?: number };
    }
  | {
      type: "bot:verified";
      tenant: string;
      botId: string;
      at: string;
    }
  | { type: string; [k: string]: any };

type Handler = (ev: LiveEvent) => void;

export function useLiveEvents(onEvent: Handler) {
  useEffect(() => {
    const base = import.meta.env.VITE_API_BASE || "/api";
    const url = `${base.replace(/\/+$/, "")}/live/${encodeURIComponent(TENANT)}`;

    const es = new EventSource(url);

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        onEvent(data as LiveEvent);
      } catch (err) {
        console.warn("[SSE parse error]", err);
      }
    };

    es.onerror = (err) => {
      console.warn("[SSE error]", err);
      // ปล่อยให้ browser จัดการ retry เอง
    };

    return () => {
      es.close();
    };
  }, [onEvent]);
}
