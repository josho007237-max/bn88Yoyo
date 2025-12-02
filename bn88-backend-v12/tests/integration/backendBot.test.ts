import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import { beforeAll, afterAll, beforeEach, describe, it } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";

import botAutomationRouter from "../../src/routes/admin/botAutomation";
import { triggerEngagementOnce } from "../../src/services/engagementScheduler";

const testDbPath = path.join(__dirname, "tmp", "backendBot.db");
const testDbUrl = `file:${testDbPath}`;

process.env.DATABASE_URL = testDbUrl;
process.env.NODE_ENV = "test";
process.env.SECRET_ENC_KEY_BN9 = process.env.SECRET_ENC_KEY_BN9 || "12345678901234567890123456789012";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt";
process.env.TENANT_DEFAULT = process.env.TENANT_DEFAULT || "tenant-1";

const prisma = new PrismaClient({ datasources: { db: { url: testDbUrl } } });

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/admin/bot", botAutomationRouter);
  return app;
}

async function resetDb() {
  fs.mkdirSync(path.dirname(testDbPath), { recursive: true });
  execSync("npx prisma db push --force-reset --skip-generate --schema prisma/schema.prisma", {
    env: { ...process.env, DATABASE_URL: testDbUrl },
    stdio: "inherit",
  });
}

async function seedBot() {
  const bot = await prisma.bot.create({
    data: { id: "bot-1", tenant: "tenant-1", name: "Bot One", platform: "line", active: true },
  });
  await prisma.botConfig.create({ data: { botId: bot.id, tenant: bot.tenant, systemPrompt: "" } });
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
  await prisma.chatMessage.deleteMany();
  await prisma.engagementMessage.deleteMany();
  await prisma.fAQ.deleteMany();
  await prisma.bot.deleteMany();
}

describe("Admin bot automation API", () => {
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

  it("handles FAQ CRUD via admin endpoints", async () => {
    const app = buildApp();

    const createRes = await request(app)
      .post("/api/admin/bot/faq")
      .send({ botId: "bot-1", question: "Q1?", answer: "A1" });
    assert.equal(createRes.status, 201);
    const createdId = createRes.body.item.id as string;

    const listRes = await request(app).get("/api/admin/bot/faq?botId=bot-1");
    assert.equal(listRes.status, 200);
    assert.equal(listRes.body.items.length, 1);

    const updateRes = await request(app)
      .put(`/api/admin/bot/faq/${createdId}`)
      .send({ answer: "A1-updated" });
    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.item.answer, "A1-updated");

    const deleteRes = await request(app).delete(`/api/admin/bot/faq/${createdId}`);
    assert.equal(deleteRes.status, 200);
    const afterDelete = await request(app).get("/api/admin/bot/faq?botId=bot-1");
    assert.equal(afterDelete.body.items.length, 0);
  });

  it("handles engagement CRUD and dispatch logging", async () => {
    const app = buildApp();

    const createRes = await request(app)
      .post("/api/admin/bot/engagement")
      .send({ botId: "bot-1", platform: "line", channelId: "U123", text: "hello", interval: 1 });
    assert.equal(createRes.status, 201);
    const engagementId = createRes.body.item.id as string;

    const listRes = await request(app).get("/api/admin/bot/engagement?botId=bot-1");
    assert.equal(listRes.status, 200);
    assert.equal(listRes.body.items.length, 1);

    const updateRes = await request(app)
      .put(`/api/admin/bot/engagement/${engagementId}`)
      .send({ enabled: false });
    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.item.enabled, false);

    const deleteRes = await request(app).delete(`/api/admin/bot/engagement/${engagementId}`);
    assert.equal(deleteRes.status, 200);
  });

  it("dispatches engagement messages and logs bot posts", async () => {
    await prisma.engagementMessage.create({
      data: {
        id: "eng-1",
        botId: "bot-1",
        platform: "line",
        channelId: "U123",
        text: "engage now",
        interval: 1,
        enabled: true,
        meta: { pollOptions: ["A", "B"] },
      },
    });

    await triggerEngagementOnce("eng-1", "req-eng-1");

    const messages = await prisma.chatMessage.findMany({ where: { botId: "bot-1" } });
    assert.equal(messages.length, 1);
    assert.equal(messages[0].senderType, "bot");
    assert.equal(messages[0].text, "engage now");
  });
});
