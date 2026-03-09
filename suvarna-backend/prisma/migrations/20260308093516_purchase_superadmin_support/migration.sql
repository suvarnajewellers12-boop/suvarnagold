-- DropForeignKey
ALTER TABLE "Purchase" DROP CONSTRAINT "Purchase_adminId_fkey";

-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN     "SuperAdminId" TEXT,
ALTER COLUMN "adminId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_SuperAdminId_fkey" FOREIGN KEY ("SuperAdminId") REFERENCES "SuperAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
