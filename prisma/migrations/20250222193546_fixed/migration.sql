/*
  Warnings:

  - You are about to drop the column `likes` on the `Content` table. All the data in the column will be lost.
  - You are about to drop the column `owner` on the `Content` table. All the data in the column will be lost.
  - Added the required column `ownerName` to the `Content` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ownerNumber` to the `Content` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Content" DROP COLUMN "likes",
DROP COLUMN "owner",
ADD COLUMN     "ownerName" TEXT NOT NULL,
ADD COLUMN     "ownerNumber" TEXT NOT NULL,
ADD COLUMN     "userId" TEXT;

-- CreateTable
CREATE TABLE "UserContentLike" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "likedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserContentLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserContentWhatsApp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "whatsappedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserContentWhatsApp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserContentLike_userId_contentId_key" ON "UserContentLike"("userId", "contentId");

-- CreateIndex
CREATE UNIQUE INDEX "UserContentWhatsApp_userId_contentId_key" ON "UserContentWhatsApp"("userId", "contentId");

-- AddForeignKey
ALTER TABLE "UserContentLike" ADD CONSTRAINT "UserContentLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserContentLike" ADD CONSTRAINT "UserContentLike_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserContentWhatsApp" ADD CONSTRAINT "UserContentWhatsApp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserContentWhatsApp" ADD CONSTRAINT "UserContentWhatsApp_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Content" ADD CONSTRAINT "Content_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
