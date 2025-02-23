-- DropForeignKey
ALTER TABLE "UserContent" DROP CONSTRAINT "UserContent_contentId_fkey";

-- DropForeignKey
ALTER TABLE "UserContent" DROP CONSTRAINT "UserContent_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserContentLike" DROP CONSTRAINT "UserContentLike_contentId_fkey";

-- DropForeignKey
ALTER TABLE "UserContentLike" DROP CONSTRAINT "UserContentLike_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserContentWhatsApp" DROP CONSTRAINT "UserContentWhatsApp_contentId_fkey";

-- DropForeignKey
ALTER TABLE "UserContentWhatsApp" DROP CONSTRAINT "UserContentWhatsApp_userId_fkey";

-- AddForeignKey
ALTER TABLE "UserContentLike" ADD CONSTRAINT "UserContentLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserContentLike" ADD CONSTRAINT "UserContentLike_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserContentWhatsApp" ADD CONSTRAINT "UserContentWhatsApp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserContentWhatsApp" ADD CONSTRAINT "UserContentWhatsApp_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserContent" ADD CONSTRAINT "UserContent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserContent" ADD CONSTRAINT "UserContent_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;
