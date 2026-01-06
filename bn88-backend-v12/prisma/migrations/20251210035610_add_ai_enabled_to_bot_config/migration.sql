-- CreateTable
CREATE TABLE "CampaignTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "exampleImageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CampaignUserProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskCode" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "lastImageUrl" TEXT,
    "lastResultJson" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BotConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "botId" TEXT NOT NULL,
    "tenant" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "temperature" REAL NOT NULL DEFAULT 0.3,
    "topP" REAL NOT NULL DEFAULT 1,
    "maxTokens" INTEGER NOT NULL DEFAULT 800,
    "systemPrompt" TEXT NOT NULL DEFAULT '',
    "aiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "presetId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BotConfig_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BotConfig_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "AiPreset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_BotConfig" ("botId", "createdAt", "id", "maxTokens", "model", "presetId", "systemPrompt", "temperature", "tenant", "topP", "updatedAt") SELECT "botId", "createdAt", "id", "maxTokens", "model", "presetId", "systemPrompt", "temperature", "tenant", "topP", "updatedAt" FROM "BotConfig";
DROP TABLE "BotConfig";
ALTER TABLE "new_BotConfig" RENAME TO "BotConfig";
CREATE UNIQUE INDEX "BotConfig_botId_key" ON "BotConfig"("botId");
CREATE INDEX "BotConfig_tenant_idx" ON "BotConfig"("tenant");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "CampaignTask_tenant_botId_code_idx" ON "CampaignTask"("tenant", "botId", "code");

-- CreateIndex
CREATE INDEX "CampaignUserProgress_tenant_botId_userId_taskCode_idx" ON "CampaignUserProgress"("tenant", "botId", "userId", "taskCode");
