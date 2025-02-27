-- CreateTable
CREATE TABLE "ContentGem" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedByUserId" TEXT,
    "claimedAt" TIMESTAMP(3),

    CONSTRAINT "ContentGem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContentGem_contentId_key" ON "ContentGem"("contentId");

-- CreateIndex
CREATE INDEX "ContentGem_contentId_idx" ON "ContentGem"("contentId");

-- CreateIndex
CREATE INDEX "ContentGem_claimedByUserId_idx" ON "ContentGem"("claimedByUserId");

-- AddForeignKey
ALTER TABLE "ContentGem" ADD CONSTRAINT "ContentGem_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentGem" ADD CONSTRAINT "ContentGem_claimedByUserId_fkey" FOREIGN KEY ("claimedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
