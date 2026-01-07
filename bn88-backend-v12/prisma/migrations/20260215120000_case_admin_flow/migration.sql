-- Add assignee relationship to CaseItem and allow new status values
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
    "assigneeId" TEXT,
    "imageIntakeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CaseItem_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CaseItem_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CaseItem_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "AdminUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CaseItem_imageIntakeId_fkey" FOREIGN KEY ("imageIntakeId") REFERENCES "ImageIntake" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_CaseItem" (
  "id", "tenant", "botId", "platform", "sessionId", "userId", "kind", "text", "meta", "status", "reviewNotes", "resolvedAt", "resolvedBy", "assigneeId", "imageIntakeId", "createdAt", "updatedAt"
)
SELECT
  "id", "tenant", "botId", "platform", "sessionId", "userId", "kind", "text", "meta", "status", "reviewNotes", "resolvedAt", "resolvedBy", NULL AS "assigneeId", "imageIntakeId", "createdAt", "updatedAt"
FROM "CaseItem";

DROP TABLE "CaseItem";
ALTER TABLE "new_CaseItem" RENAME TO "CaseItem";

CREATE INDEX "CaseItem_byBotDate" ON "CaseItem"("botId", "createdAt");
CREATE INDEX "CaseItem_byTenantStatusDate" ON "CaseItem"("tenant", "status", "createdAt");
CREATE INDEX "CaseItem_byTenantBotStatus" ON "CaseItem"("tenant", "botId", "status");
CREATE INDEX "CaseItem_assignee_status" ON "CaseItem"("tenant", "assigneeId", "status");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
