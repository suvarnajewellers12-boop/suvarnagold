/*
  Warnings:

  - You are about to drop the column `cost` on the `Product` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Product" DROP COLUMN "cost",
ADD COLUMN     "bodyPart" TEXT NOT NULL DEFAULT 'others',
ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'others',
ADD COLUMN     "huid" TEXT,
ADD COLUMN     "netWeight" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "stoneWeight" DOUBLE PRECISION NOT NULL DEFAULT 0;
