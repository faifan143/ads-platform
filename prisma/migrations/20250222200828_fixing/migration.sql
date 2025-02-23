/*
  Warnings:

  - You are about to drop the column `userId` on the `Content` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Content" DROP CONSTRAINT "Content_userId_fkey";

-- AlterTable
ALTER TABLE "Content" DROP COLUMN "userId";
