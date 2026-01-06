export async function pushLineText(params: {
  channelAccessToken: string;
  to: string; // LINE userId
  text: string;
}) {
  const r = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.channelAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: params.to,
      messages: [{ type: "text", text: params.text }],
    }),
  });

  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`LINE push failed: ${r.status} ${t}`);
  }
}

