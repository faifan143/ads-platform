/*
  Warnings:

  - You are about to drop the `_ContentToInterest` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_ContentToInterest" DROP CONSTRAINT "_ContentToInterest_A_fkey";

-- DropForeignKey
ALTER TABLE "_ContentToInterest" DROP CONSTRAINT "_ContentToInterest_B_fkey";

-- DropTable
DROP TABLE "_ContentToInterest";

-- CreateTable
CREATE TABLE "_UserInterest" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_UserInterest_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_InterestContent" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_InterestContent_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_UserInterest_B_index" ON "_UserInterest"("B");

-- CreateIndex
CREATE INDEX "_InterestContent_B_index" ON "_InterestContent"("B");

-- AddForeignKey
ALTER TABLE "_UserInterest" ADD CONSTRAINT "_UserInterest_A_fkey" FOREIGN KEY ("A") REFERENCES "Interest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserInterest" ADD CONSTRAINT "_UserInterest_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InterestContent" ADD CONSTRAINT "_InterestContent_A_fkey" FOREIGN KEY ("A") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InterestContent" ADD CONSTRAINT "_InterestContent_B_fkey" FOREIGN KEY ("B") REFERENCES "Interest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
