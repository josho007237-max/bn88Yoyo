import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { beforeAll, afterAll, beforeEach, describe, it } from "vitest";
import { PrismaClient } from "@prisma/client";

import { createCaseWithDedupe, pendingTTL } from "../src/services/cases";

const testDbPath = path.join(__dirname, "integration", "tmp", "caseDedupe.db");
const testDbUrl = `file:${testDbPath}`;

process.env.DATABASE_URL = testDbUrl;
process.env.NODE_ENV = "test";
process.env.SECRET_ENC_KEY_BN9 =
  process.env.SECRET_ENC_KEY_BN9 || "12345678901234567890123456789012";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt";
process.env.TENANT_DEFAULT = process.env.TENANT_DEFAULT || "tenant-1";

const prisma = new PrismaClient({ datasources: { db: { url: testDbUrl } } });

async function resetDb() {
  fs.mkdirSync(path.dirname(testDbPath), { recursive: true });
  execSync(
    "npx prisma db push --force-reset --skip-generate --schema prisma/schema.prisma",
    {
      env: { ...process.env, DATABASE_URL: testDbUrl },
      stdio: "inherit",
    }
  );
}

async function seedBot() {
  const bot = await prisma.bot.create({
    data: { id: "bot-1", tenant: "tenant-1", name: "Bot", platform: "line", active: true },
  });
  await prisma.botConfig.create({ data: { botId: bot.id, tenant: bot.tenant, systemPrompt: "", aiEnabled: false } });
  await prisma.botSecret.create({
    data: {
      botId: bot.id,
      channelAccessToken: "dummy-line-token",
      channelSecret: "dummy-line-secret",
      telegramBotToken: "dummy-telegram-token",
    },
  });
  return bot;
}

async function clearDb() {
  await prisma.caseItem.deleteMany();
  await prisma.chatSession.deleteMany();
  await prisma.botConfig.deleteMany();
  await prisma.botSecret.deleteMany();
  await prisma.bot.deleteMany();
}

describe("case dedupe", () => {
  beforeAll(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await clearDb();
    await seedBot();
  });

  it("dedupes within 15 minutes and appends notes", async () => {
    const session = await prisma.chatSession.create({
      data: {
        tenant: "tenant-1",
        botId: "bot-1",
        platform: "line",
        userId: "user-1",
        status: "open",
        lastMessageAt: new Date(),
        lastDirection: "user",
      },
    });

    const first = await createCaseWithDedupe({
      tenant: "tenant-1",
      botId: "bot-1",
      platform: "line",
      sessionId: session.id,
      userId: "user-1",
      kind: "deposit_missing",
      text: "first issue",
      meta: { intent: "deposit_missing" },
      noteVia: "text",
    });

    const second = await createCaseWithDedupe({
      tenant: "tenant-1",
      botId: "bot-1",
      platform: "line",
      sessionId: session.id,
      userId: "user-1",
      kind: "deposit_missing",
      text: "follow up",
      meta: { intent: "deposit_missing" },
      noteVia: "text",
    });

    assert.equal(second.created, false);
    assert.equal(first.caseItem.id, second.caseItem.id);

    const stored = await prisma.caseItem.findUnique({ where: { id: first.caseItem.id } });
    assert.ok(stored);
    const meta = stored?.meta as any;
    assert.ok(Array.isArray(meta.notes));
    assert.equal(meta.notes.length, 2);
    assert.equal(meta.notes[1].text, "follow up");
  });

  it("creates a new case when outside the dedupe window", async () => {
    const session = await prisma.chatSession.create({
      data: {
        tenant: "tenant-1",
        botId: "bot-1",
        platform: "line",
        userId: "user-2",
        status: "open",
        lastMessageAt: new Date(),
        lastDirection: "user",
      },
    });

    const first = await createCaseWithDedupe({
      tenant: "tenant-1",
      botId: "bot-1",
      platform: "line",
      sessionId: session.id,
      userId: "user-2",
      kind: "withdraw_issue",
      text: "old issue",
      meta: { intent: "withdraw_issue" },
      noteVia: "text",
    });

    await prisma.caseItem.update({
      where: { id: first.caseItem.id },
      data: {
        createdAt: new Date(Date.now() - 16 * 60 * 1000),
        updatedAt: new Date(Date.now() - 16 * 60 * 1000),
      },
    });

    const second = await createCaseWithDedupe({
      tenant: "tenant-1",
      botId: "bot-1",
      platform: "line",
      sessionId: session.id,
      userId: "user-2",
      kind: "withdraw_issue",
      text: "new issue",
      meta: { intent: "withdraw_issue" },
      noteVia: "text",
    });

    assert.notEqual(first.caseItem.id, second.caseItem.id);
  });

  it("detects pending TTL expiry", () => {
    const twelveHoursMs = 12 * 60 * 60 * 1000;
    assert.equal(pendingTTL(Date.now() - twelveHoursMs - 1000), true);
    assert.equal(pendingTTL(Date.now() - twelveHoursMs + 1000), false);
  });
});
