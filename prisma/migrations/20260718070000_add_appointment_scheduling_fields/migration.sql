-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "appointments"
  ADD COLUMN     "startsAt" TIMESTAMPTZ(3) NOT NULL,
  ADD COLUMN     "endsAt" TIMESTAMPTZ(3) NOT NULL,
  ADD COLUMN     "status" "AppointmentStatus" NOT NULL DEFAULT 'CONFIRMED';

-- DropIndex
DROP INDEX IF EXISTS "appointments_staffId_idx";

-- CreateIndex
CREATE INDEX "appointments_staffId_startsAt_idx" ON "appointments"("staffId", "startsAt");
