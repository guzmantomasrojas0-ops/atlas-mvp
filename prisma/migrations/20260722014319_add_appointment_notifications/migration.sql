-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('REMINDER_24H', 'REMINDER_2H', 'THANK_YOU');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "appointment_notifications" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "targetAt" TIMESTAMPTZ(3) NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMPTZ(3),
    "lastError" TEXT,
    "sentAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointment_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "appointment_notifications_businessId_idx" ON "appointment_notifications"("businessId");

-- CreateIndex
CREATE INDEX "appointment_notifications_status_idx" ON "appointment_notifications"("status");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_notifications_appointmentId_type_targetAt_key" ON "appointment_notifications"("appointmentId", "type", "targetAt");

-- AddForeignKey
ALTER TABLE "appointment_notifications" ADD CONSTRAINT "appointment_notifications_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_notifications" ADD CONSTRAINT "appointment_notifications_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
