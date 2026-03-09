/*
  Warnings:

  - You are about to drop the column `SuperAdminId` on the `Purchase` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Purchase" DROP CONSTRAINT "Purchase_SuperAdminId_fkey";

-- AlterTable
ALTER TABLE "Purchase" DROP COLUMN "SuperAdminId",
ADD COLUMN     "superAdminId" TEXT;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_superAdminId_fkey" FOREIGN KEY ("superAdminId") REFERENCES "SuperAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
