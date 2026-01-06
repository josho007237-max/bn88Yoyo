// src/components/chat/ChatMessageBubble.tsx
import React from "react";

export type ChatMessage = {
  id: string;
  senderType: "user" | "bot" | "admin" | "system";
  type: "TEXT" | "IMAGE" | "FILE" | "STICKER" | "SYSTEM" | "RICH" | "INLINE_KEYBOARD";
  text?: string | null;
  createdAt: string;
  attachmentUrl?: string | null;
  attachmentMeta?: any;
};

type Props = {
  msg: ChatMessage;
};

export function ChatMessageBubble({ msg }: Props) {
  const time = new Date(msg.createdAt).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const isUser = msg.senderType === "user";
  const isBot = msg.senderType === "bot";
  const isAdmin = msg.senderType === "admin";

  const alignClass = isUser ? "justify-start" : "justify-end";
  const bgClass = isBot
    ? "bg-emerald-700"
    : isAdmin
    ? "bg-sky-700"
    : "bg-neutral-800";

  return (
    <div className={`flex ${alignClass} mb-2`}>
      <div className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm text-white ${bgClass}`}>
        {/* ข้อความหลัก */}
        {msg.text && (
          <div className="whitespace-pre-wrap break-words">
            {msg.text}
          </div>
        )}

        {/* รูปภาพ (ลูกค้าส่งมา) */}
        {msg.attachmentUrl && msg.type === "IMAGE" && (
          <a
            href={msg.attachmentUrl}
            target="_blank"
            rel="noreferrer"
            className="block mt-2 overflow-hidden rounded-xl border border-white/10"
          >
            <img
              src={msg.attachmentUrl}
              alt={String(msg.attachmentMeta?.fileName ?? "image")}
              className="max-h-64 w-auto object-contain"
            />
          </a>
        )}

        {/* ไฟล์แนบ เช่น สลิป, PDF ฯลฯ */}
        {msg.attachmentUrl && msg.type === "FILE" && (
          <a
            href={msg.attachmentUrl}
            target="_blank"
            rel="noreferrer"
            className="block mt-2 text-xs underline text-emerald-200"
          >
            {msg.attachmentMeta?.fileName ?? "เปิดไฟล์ที่แนบ"}
          </a>
        )}

        {/* สติ๊กเกอร์ */}
        {msg.type === "STICKER" && (
          <div className="mt-2 text-xs text-emerald-200">
            ส่งสติ๊กเกอร์ (package {msg.attachmentMeta?.packageId ?? "-"},{" "}
            sticker {msg.attachmentMeta?.stickerId ?? "-"})
          </div>
        )}

        {/* เวลา */}
        <div className="mt-1 text-[10px] text-white/50 text-right">
          {time}
        </div>
      </div>
    </div>
  );
}
