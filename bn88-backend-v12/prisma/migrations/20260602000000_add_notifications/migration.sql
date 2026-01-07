CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant" TEXT NOT NULL,
    "botId" TEXT,
    "caseId" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" DATETIME,
    "readById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Notification_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CaseItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Notification_readById_fkey" FOREIGN KEY ("readById") REFERENCES "AdminUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Notification_byTenantRead" ON "Notification"("tenant", "isRead", "createdAt");
CREATE INDEX "Notification_byTenantBotDate" ON "Notification"("tenant", "botId", "createdAt");
CREATE INDEX "Notification_byCase" ON "Notification"("caseId");
