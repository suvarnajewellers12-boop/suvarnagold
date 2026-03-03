-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "dateOfJoining" TIMESTAMP(3) NOT NULL,
    "monthlySalary" DOUBLE PRECISION NOT NULL,
    "gender" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "aadharNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Staff_phoneNumber_key" ON "Staff"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_aadharNumber_key" ON "Staff"("aadharNumber");
