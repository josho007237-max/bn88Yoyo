// src/lib/emitters.ts
import { sseHub } from "./sseHub";

export function emitLineChatMessageNew(args: {
  tenant: string;
  botId: string;
  sessionId: string;
  messageId: string;
}) {
  sseHub.broadcast({
    tenant: args.tenant,
    type: "chat:message:new",
    data: {
      platform: "line",
      botId: args.botId,
      sessionId: args.sessionId,
      messageId: args.messageId,
    },
  });
}

