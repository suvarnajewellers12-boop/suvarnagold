-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "gstAmount" DOUBLE PRECISION NOT NULL,
    "discountAmount" DOUBLE PRECISION NOT NULL,
    "finalAmount" DOUBLE PRECISION NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "paymentId" TEXT,
    "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adminId" TEXT NOT NULL,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseItem" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "grams" DOUBLE PRECISION NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PurchaseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scheme" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "durationMonths" INTEGER NOT NULL,
    "monthlyAmount" DOUBLE PRECISION NOT NULL,
    "maturityAmount" DOUBLE PRECISION NOT NULL,
    "completionCoupon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Scheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerScheme" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "totalPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remainingAmount" DOUBLE PRECISION NOT NULL,
    "installmentsPaid" INTEGER NOT NULL DEFAULT 0,
    "installmentsLeft" INTEGER NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "couponGenerated" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerScheme_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_username_key" ON "Customer"("username");

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerScheme" ADD CONSTRAINT "CustomerScheme_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerScheme" ADD CONSTRAINT "CustomerScheme_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "Scheme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
