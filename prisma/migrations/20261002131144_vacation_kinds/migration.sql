-- CreateEnum
CREATE TYPE "VacationKind" AS ENUM ('REGULAR', 'SPECIAL', 'REGENERATION');

-- AlterTable
ALTER TABLE "VacationRequest" ADD COLUMN     "kind" "VacationKind" NOT NULL DEFAULT 'REGULAR';
