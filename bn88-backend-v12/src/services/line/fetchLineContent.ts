// src/services/line/fetchLineContent.ts
export async function fetchLineMessageContent(
  messageId: string,
  channelAccessToken: string
): Promise<{ buffer: Buffer; mime: string }> {
  const resp = await fetch(
    `https://api-data.line.me/v2/bot/message/${encodeURIComponent(messageId)}/content`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${channelAccessToken}`,
      },
    }
  );

  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`LINE content fetch failed: ${resp.status} ${t}`);
  }

  const mime = resp.headers.get("content-type") || "application/octet-stream";
  const ab = await resp.arrayBuffer();
  return { buffer: Buffer.from(ab), mime };
}

