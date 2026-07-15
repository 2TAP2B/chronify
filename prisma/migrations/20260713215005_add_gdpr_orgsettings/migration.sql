-- AlterTable
ALTER TABLE "OrgSettings" ADD COLUMN     "auditLogRetentionMonths" INTEGER NOT NULL DEFAULT 6,
ADD COLUMN     "imprintAddress" TEXT,
ADD COLUMN     "imprintEmail" TEXT,
ADD COLUMN     "imprintName" TEXT,
ADD COLUMN     "imprintPhone" TEXT,
ADD COLUMN     "privacyPolicyUrl" TEXT,
ADD COLUMN     "retentionYears" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "sickNoteRetentionMonths" INTEGER NOT NULL DEFAULT 12,
ALTER COLUMN "appName" SET DEFAULT 'Chronify';
