-- CreateEnum
CREATE TYPE "ClosureChoiceType" AS ENUM ('VACATION', 'OVERTIME');

-- CreateTable
CREATE TABLE "WorkingModelTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mondayMinutes" INTEGER NOT NULL DEFAULT 0,
    "tuesdayMinutes" INTEGER NOT NULL DEFAULT 0,
    "wednesdayMinutes" INTEGER NOT NULL DEFAULT 0,
    "thursdayMinutes" INTEGER NOT NULL DEFAULT 0,
    "fridayMinutes" INTEGER NOT NULL DEFAULT 0,
    "saturdayMinutes" INTEGER NOT NULL DEFAULT 0,
    "sundayMinutes" INTEGER NOT NULL DEFAULT 0,
    "weeklyTargetMinutes" INTEGER NOT NULL DEFAULT 0,
    "autoBreakThreshold6h" BOOLEAN NOT NULL DEFAULT true,
    "autoBreakMinutes6h" INTEGER NOT NULL DEFAULT 30,
    "autoBreakThreshold9h" BOOLEAN NOT NULL DEFAULT true,
    "autoBreakMinutes9h" INTEGER NOT NULL DEFAULT 45,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkingModelTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessClosure" (
    "id" TEXT NOT NULL,
    "from" TIMESTAMP(3) NOT NULL,
    "to" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessClosure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClosureChoice" (
    "id" TEXT NOT NULL,
    "closureId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "choice" "ClosureChoiceType" NOT NULL DEFAULT 'VACATION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClosureChoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkingModelTemplate_name_key" ON "WorkingModelTemplate"("name");

-- CreateIndex
CREATE INDEX "BusinessClosure_from_to_idx" ON "BusinessClosure"("from", "to");

-- CreateIndex
CREATE INDEX "ClosureChoice_userId_idx" ON "ClosureChoice"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClosureChoice_closureId_userId_key" ON "ClosureChoice"("closureId", "userId");

-- AddForeignKey
ALTER TABLE "ClosureChoice" ADD CONSTRAINT "ClosureChoice_closureId_fkey" FOREIGN KEY ("closureId") REFERENCES "BusinessClosure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClosureChoice" ADD CONSTRAINT "ClosureChoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddColumn: VacationRequest.useOvertime
ALTER TABLE "VacationRequest" ADD COLUMN "useOvertime" BOOLEAN NOT NULL DEFAULT false;

-- AddColumn: OvertimeBalance.consumedOvertimeMinutes
ALTER TABLE "OvertimeBalance" ADD COLUMN "consumedOvertimeMinutes" INTEGER NOT NULL DEFAULT 0;

-- AddColumn: User.hireDate
ALTER TABLE "User" ADD COLUMN "hireDate" TIMESTAMP(3);

-- AddColumn: User.nfcCardId
ALTER TABLE "User" ADD COLUMN "nfcCardId" TEXT;

-- CreateIndex: User.nfcCardId unique
CREATE UNIQUE INDEX "User_nfcCardId_key" ON "User"("nfcCardId");
