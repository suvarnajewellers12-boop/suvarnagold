-- CreateTable
CREATE TABLE "GoldPurchase" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "goldType" TEXT NOT NULL,
    "grams" DOUBLE PRECISION NOT NULL,
    "pricePerGram" DOUBLE PRECISION NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "invoiceNumber" TEXT,
    "paymentMode" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoldPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoldJobWork" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "goldGivenType" TEXT NOT NULL,
    "goldGivenGrams" DOUBLE PRECISION NOT NULL,
    "makingCharge" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "dateGiven" TIMESTAMP(3) NOT NULL,
    "dateReceived" TIMESTAMP(3),
    "wastageGrams" DOUBLE PRECISION,
    "returnedGoldGrams" DOUBLE PRECISION,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoldJobWork_pkey" PRIMARY KEY ("id")
);
