import { prisma } from "../lib/prisma";

async function main() {
  const tenant = "bn9";

  console.log("=== ChatSession (tenant=bn9) ===");
  const sessions = await prisma.chatSession.findMany({
    where: { tenant },
    orderBy: { lastMessageAt: "desc" },
    take: 10,
  });
  console.table(
    sessions.map((s) => ({
      id: s.id,
      botId: s.botId,
      platform: s.platform,
      userId: s.userId,
      lastMessageAt: s.lastMessageAt,
    }))
  );

  if (sessions[0]) {
    console.log("\n=== ChatMessage for latest session ===");
    const messages = await prisma.chatMessage.findMany({
      where: { tenant, sessionId: sessions[0].id },
      orderBy: { createdAt: "asc" },
    });
    console.table(
      messages.map((m) => ({
        id: m.id,
        senderType: m.senderType,
        text: m.text,
        createdAt: m.createdAt,
      }))
    );
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
