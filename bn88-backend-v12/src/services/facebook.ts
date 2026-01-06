// src/services/facebook.ts
import { config } from "../config";

export async function sendFacebookMessage(
  pageAccessToken: string,
  psid: string,
  text: string
): Promise<boolean> {
  if (!pageAccessToken) {
    console.warn("[FACEBOOK] Missing pageAccessToken");
    return false;
  }

  const url = `https://graph.facebook.com/v18.0/me/messages?access_token=${encodeURIComponent(
    pageAccessToken
  )}`;

  const body = {
    messaging_type: "RESPONSE",
    recipient: { id: psid },
    message: { text },
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    console.warn("[FACEBOOK sendMessage warning]", resp.status, t);
    return false;
  }

  const data = (await resp.json().catch(() => null)) as any;
  if (!data || !data.recipient_id) {
    console.warn("[FACEBOOK sendMessage bad response]", data);
    return false;
  }

  return true;
}

