// src/services/line/lineGetMessageContent.ts
export async function lineGetMessageContent(
  messageId: string,
  channelAccessToken: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const f = (globalThis as any).fetch as typeof fetch | undefined;
  if (!f)
    throw new Error("global fetch is not available (Node 18+/20 required)");

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
    console.warn("[LINE content] failed", resp.status, t);
    return null;
  }

  const ab = await resp.arrayBuffer();
  const contentType =
    resp.headers.get("content-type") || "application/octet-stream";
  return { buffer: Buffer.from(ab), contentType };
}

