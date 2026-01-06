// src/services/vision/lineContent.ts
export async function fetchLineMessageContentBuffer(
  messageId: string,
  channelAccessToken: string
): Promise<{ buf: Buffer; mime: string }> {
  const f = (globalThis as any).fetch as typeof fetch | undefined;
  if (!f) throw new Error("global fetch is not available");

  const url = `https://api-data.line.me/v2/bot/message/${encodeURIComponent(
    messageId
  )}/content`;

  const resp = await f(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${channelAccessToken}`,
    },
  });

  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`LINE content fetch failed ${resp.status}: ${t}`);
  }

  const mime = resp.headers.get("content-type") || "application/octet-stream";
  const ab = await resp.arrayBuffer();
  return { buf: Buffer.from(ab), mime };
}

