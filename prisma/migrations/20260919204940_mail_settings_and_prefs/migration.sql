-- AlterTable
ALTER TABLE "OrgSettings" ADD COLUMN     "smtpFrom" TEXT,
ADD COLUMN     "smtpHost" TEXT,
ADD COLUMN     "smtpPassword" TEXT,
ADD COLUMN     "smtpPort" INTEGER,
ADD COLUMN     "smtpTls" BOOLEAN,
ADD COLUMN     "smtpUser" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "sickMailEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "vacationMailEnabled" BOOLEAN NOT NULL DEFAULT true;
