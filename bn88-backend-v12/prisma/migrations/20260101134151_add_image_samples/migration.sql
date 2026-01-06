-- CreateTable
CREATE TABLE "ImageSample" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "ahash" TEXT NOT NULL,
    "note" TEXT,
    "filePath" TEXT,
    "mime" TEXT,
    "size" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "ImageSample_tenant_botId_label_idx" ON "ImageSample"("tenant", "botId", "label");

-- CreateIndex
CREATE INDEX "ImageSample_tenant_botId_ahash_idx" ON "ImageSample"("tenant", "botId", "ahash");
