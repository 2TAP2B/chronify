-- CreateEnum
CREATE TYPE "ReportAutomationFrequency" AS ENUM ('WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "ReportAutomationScope" AS ENUM ('ALL', 'SELECTED');

-- CreateEnum
CREATE TYPE "ReportAutomationRunKind" AS ENUM ('SCHEDULED', 'MANUAL');

-- CreateEnum
CREATE TYPE "ReportAutomationRunStatus" AS ENUM ('SUCCESS', 'PARTIAL', 'ERROR');

-- CreateTable
CREATE TABLE "ReportAutomation" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "frequency" "ReportAutomationFrequency" NOT NULL DEFAULT 'WEEKLY',
    "weeklyDay" INTEGER NOT NULL DEFAULT 1,
    "monthlyDay" INTEGER NOT NULL DEFAULT 1,
    "runHour" INTEGER NOT NULL DEFAULT 6,
    "scope" "ReportAutomationScope" NOT NULL DEFAULT 'ALL',
    "userIds" JSONB NOT NULL DEFAULT '[]',
    "subfolder" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportAutomation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportAutomationRun" (
    "id" TEXT NOT NULL,
    "kind" "ReportAutomationRunKind" NOT NULL,
    "periodKey" TEXT NOT NULL,
    "status" "ReportAutomationRunStatus" NOT NULL,
    "generated" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ReportAutomationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportAutomationRun_startedAt_idx" ON "ReportAutomationRun"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReportAutomationRun_kind_periodKey_key" ON "ReportAutomationRun"("kind", "periodKey");
