-- CreateTable
CREATE TABLE "OtpVerification" (
    "id" TEXT NOT NULL,
    "phoneNumber" VARCHAR(15) NOT NULL,
    "otpCode" VARCHAR(6) NOT NULL,
    "purpose" VARCHAR(50) NOT NULL,
    "requestedById" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OtpVerification_phoneNumber_idx" ON "OtpVerification"("phoneNumber");

-- CreateIndex
CREATE INDEX "OtpVerification_purpose_idx" ON "OtpVerification"("purpose");

-- CreateIndex
CREATE INDEX "OtpVerification_phoneNumber_purpose_idx" ON "OtpVerification"("phoneNumber", "purpose");
