-- CreateTable
CREATE TABLE "DailyRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "channelKey" TEXT NOT NULL DEFAULT 'default',
    "dateKey" TEXT NOT NULL,
    "conditions" JSONB NOT NULL,
    "passReply" TEXT NOT NULL,
    "failReply" TEXT NOT NULL,
    "reviewReply" TEXT NOT NULL,
    "needInfoReply" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DailyRule_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CodePool" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "ruleId" TEXT,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "expiresAt" DATETIME,
    "usedAt" DATETIME,
    "usedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CodePool_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CodePool_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "DailyRule" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImageIntake" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "channelKey" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "chatMessageId" TEXT,
    "imageUrl" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "confidence" REAL,
    "rawJson" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImageIntake_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ImageIntake_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ImageIntake_chatMessageId_fkey" FOREIGN KEY ("chatMessageId") REFERENCES "ChatMessage" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CodeRedemption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "codePoolId" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "redeemedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CodeRedemption_codePoolId_fkey" FOREIGN KEY ("codePoolId") REFERENCES "CodePool" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CaseItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "sessionId" TEXT,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "meta" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewNotes" TEXT,
    "resolvedAt" DATETIME,
    "resolvedBy" TEXT,
    "imageIntakeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CaseItem_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CaseItem_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CaseItem_imageIntakeId_fkey" FOREIGN KEY ("imageIntakeId") REFERENCES "ImageIntake" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CaseItem" ("botId", "createdAt", "id", "kind", "meta", "platform", "sessionId", "tenant", "text", "userId") SELECT "botId", "createdAt", "id", "kind", "meta", "platform", "sessionId", "tenant", "text", "userId" FROM "CaseItem";
DROP TABLE "CaseItem";
ALTER TABLE "new_CaseItem" RENAME TO "CaseItem";
CREATE INDEX "CaseItem_byBotDate" ON "CaseItem"("botId", "createdAt");
CREATE INDEX "CaseItem_byTenantStatusDate" ON "CaseItem"("tenant", "status", "createdAt");
CREATE INDEX "CaseItem_byTenantBotStatus" ON "CaseItem"("tenant", "botId", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "DailyRule_tenant_botId_dateKey_idx" ON "DailyRule"("tenant", "botId", "dateKey");

-- CreateIndex
CREATE UNIQUE INDEX "daily_rule_unique" ON "DailyRule"("tenant", "botId", "platform", "channelKey", "dateKey");

-- CreateIndex
CREATE INDEX "CodePool_tenant_botId_status_idx" ON "CodePool"("tenant", "botId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CodePool_tenant_botId_code_key" ON "CodePool"("tenant", "botId", "code");

-- CreateIndex
CREATE INDEX "ImageIntake_tenant_botId_createdAt_idx" ON "ImageIntake"("tenant", "botId", "createdAt");

-- CreateIndex
CREATE INDEX "ImageIntake_tenant_userId_createdAt_idx" ON "ImageIntake"("tenant", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "CodeRedemption_tenant_botId_redeemedAt_idx" ON "CodeRedemption"("tenant", "botId", "redeemedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CodeRedemption_tenant_botId_userId_ruleId_dateKey_key" ON "CodeRedemption"("tenant", "botId", "userId", "ruleId", "dateKey");
