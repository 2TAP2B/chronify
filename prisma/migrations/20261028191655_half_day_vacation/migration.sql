-- AlterTable
ALTER TABLE "OrgSettings" ADD COLUMN     "heiligabendHalfDay" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "silvesterHalfDay" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "VacationRequest" ADD COLUMN     "halfDay" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "WorkingModel" ADD COLUMN     "halfDayMinutes" INTEGER;
