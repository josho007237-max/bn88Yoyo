import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import { PrismaClient, MessageType } from "@prisma/client";

const testDbPath = path.join(__dirname, "integration", "tmp", "metrics.db");
const testDbUrl = `file:${testDbPath}`;

process.env.DATABASE_URL = testDbUrl;
process.env.NODE_ENV = "test";
process.env.SECRET_ENC_KEY_BN9 =
  process.env.SECRET_ENC_KEY_BN9 || "12345678901234567890123456789012";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt";
process.env.TENANT_DEFAULT = process.env.TENANT_DEFAULT || "tenant-1";

const prisma = new PrismaClient({ datasources: { db: { url: testDbUrl } } });

let processIncomingMessage: typeof import("../src/services/inbound/processIncomingMessage")["processIncomingMessage"];
let createCaseWithDedupe: typeof import("../src/services/cases")["createCaseWithDedupe"];
let adminCasesRouter: typeof import("../src/routes/admin/cases").default;
let adminMetricsRouter: typeof import("../src/routes/admin/metrics").default;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/admin/cases", adminCasesRouter);
  app.use("/api/admin/metrics", adminMetricsRouter);
  return app;
}

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
    data: {
      id: "bot-metrics",
      tenant: "tenant-1",
      name: "Metrics Bot",
      platform: "line",
      active: true,
    },
  });

  await prisma.botConfig.create({
    data: {
      botId: bot.id,
      tenant: bot.tenant,
      systemPrompt: "",
      aiEnabled: false,
    },
  });

  await prisma.botSecret.create({
    data: { botId: bot.id },
  });

  return bot;
}

async function clearDb() {
  await prisma.chatMessage.deleteMany();
  await prisma.chatSession.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.caseItem.deleteMany();
  await prisma.statDaily.deleteMany();
  await prisma.bot.deleteMany();
}

describe("metrics aggregation", () => {
  beforeAll(async () => {
    await resetDb();
    ({ processIncomingMessage } = await import(
      "../src/services/inbound/processIncomingMessage"
    ));
    ({ createCaseWithDedupe } = await import("../src/services/cases"));
    ({ default: adminCasesRouter } = await import("../src/routes/admin/cases"));
    ({ default: adminMetricsRouter } = await import(
      "../src/routes/admin/metrics"
    ));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await clearDb();
    await seedBot();
  });

  it("counts chat and case metrics and exposes admin endpoints", async () => {
    const bot = await prisma.bot.findFirstOrThrow({ where: { id: "bot-metrics" } });

    await processIncomingMessage({
      botId: bot.id,
      platform: "line",
      userId: "u-1",
      text: "สวัสดี",
      messageType: MessageType.TEXT,
    });

    const { caseItem } = await createCaseWithDedupe({
      tenant: bot.tenant,
      botId: bot.id,
      platform: "line",
      userId: "u-1",
      kind: "deposit_missing",
      text: "ฝากเงินไม่เข้า",
    });

    const app = buildApp();
    const server = app.listen(0);
    const addr = server.address();
    const baseUrl = `http://127.0.0.1:${(addr as any).port}`;

    const patchResp = await fetch(`${baseUrl}/api/admin/cases/${caseItem.id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-tenant": bot.tenant,
      },
      body: JSON.stringify({ status: "RESOLVED" }),
    });

    expect(patchResp.status).toBe(200);

    const today = new Date().toISOString().slice(0, 10);

    const chatResp = await fetch(
      `${baseUrl}/api/admin/metrics/chat?from=${today}&to=${today}&botId=${bot.id}`,
      {
        headers: { "x-tenant": bot.tenant },
      }
    );

    expect(chatResp.status).toBe(200);
    const chatJson = (await chatResp.json()) as any;
    expect(chatJson.summary.messageIn).toBeGreaterThanOrEqual(1);
    expect(chatJson.summary.messageOut).toBeGreaterThanOrEqual(1);

    const caseResp = await fetch(
      `${baseUrl}/api/admin/metrics/cases?from=${today}&to=${today}&botId=${bot.id}`,
      {
        headers: { "x-tenant": bot.tenant },
      }
    );
    expect(caseResp.status).toBe(200);
    const caseJson = (await caseResp.json()) as any;

    expect(caseJson.summary.casesNew).toBe(1);
    expect(caseJson.summary.casesResolved).toBe(1);

    server.close();
  });
});
