// src/services/line.ts
// ใช้ global fetch ของ Node 18+ / 20+ ได้เลย ไม่ต้องติดตั้ง node-fetch

export type LinePushPayload = {
  channelAccessToken: string; // LINE channel access token ของบอท
  to: string;                 // userId จาก LINE (เช่น Uxxxxxxxxx)
  text: string;               // ข้อความที่ต้องการส่ง
};

/**
 * ส่งข้อความแบบ push ไปหา user ทาง LINE
 * ใช้ตอนแอดมินตอบจากหลังบ้าน (ไม่มี replyToken แล้ว)
 */
export async function sendLinePushMessage(
  { channelAccessToken, to, text }: LinePushPayload
): Promise<void> {
  const url = "https://api.line.me/v2/bot/message/push";

  const body = {
    to,
    messages: [
      {
        type: "text",
        text,
      },
    ],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${channelAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    console.error("[LINE push] error", res.status, t);
    throw new Error(`LINE_PUSH_FAILED_${res.status}`);
  }
}

