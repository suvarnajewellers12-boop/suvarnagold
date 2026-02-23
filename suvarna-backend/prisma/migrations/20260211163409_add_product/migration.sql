-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "metalType" TEXT NOT NULL,
    "grams" DOUBLE PRECISION NOT NULL,
    "carats" TEXT NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "manufactureDate" TIMESTAMP(3) NOT NULL,
    "uniqueCode" TEXT NOT NULL,
    "isSold" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "soldAt" TIMESTAMP(3),

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_uniqueCode_key" ON "Product"("uniqueCode");
