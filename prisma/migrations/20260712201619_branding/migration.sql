-- AlterTable
ALTER TABLE "OrgSettings" ADD COLUMN     "appLogo" TEXT,
ADD COLUMN     "appName" TEXT NOT NULL DEFAULT 'Puku Zeiterfassung',
ADD COLUMN     "loginImage" TEXT,
ADD COLUMN     "loginQuote" TEXT,
ADD COLUMN     "loginQuoteAuthor" TEXT;
