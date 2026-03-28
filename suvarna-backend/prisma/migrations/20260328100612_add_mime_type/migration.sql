-- AlterTable
ALTER TABLE "ProductImgs" ADD COLUMN     "metalType" TEXT NOT NULL DEFAULT 'gold',
ADD COLUMN     "mimeType" TEXT NOT NULL DEFAULT 'image/jpeg';
