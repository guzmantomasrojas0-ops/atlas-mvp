/*
  Warnings:

  - You are about to drop the `agent_actions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "agent_actions" DROP CONSTRAINT "agent_actions_conversationId_fkey";

-- DropForeignKey
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_userId_fkey";

-- DropIndex
DROP INDEX "appointment_notifications_status_idx";

-- DropIndex
DROP INDEX "appointments_businessId_idx";

-- DropIndex
DROP INDEX "payments_businessId_idx";

-- DropTable
DROP TABLE "agent_actions";

-- CreateIndex
CREATE INDEX "appointments_businessId_startsAt_idx" ON "appointments"("businessId", "startsAt");

-- CreateIndex
CREATE INDEX "payments_businessId_confirmedAt_idx" ON "payments"("businessId", "confirmedAt");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
