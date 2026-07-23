/*
  Warnings:

  - Added the required column `channel` to the `conversations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `clientId` to the `conversations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `content` to the `messages` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sender` to the `messages` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ConversationChannel" AS ENUM ('WHATSAPP', 'INSTAGRAM', 'SMS', 'WEB_CHAT');

-- CreateEnum
CREATE TYPE "MessageSender" AS ENUM ('CLIENT', 'STAFF', 'AGENT');

-- DropIndex
DROP INDEX "conversations_businessId_idx";

-- DropIndex
DROP INDEX "messages_conversationId_idx";

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "channel" "ConversationChannel" NOT NULL,
ADD COLUMN     "clientId" TEXT NOT NULL,
ADD COLUMN     "lastReadAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "content" TEXT NOT NULL,
ADD COLUMN     "sender" "MessageSender" NOT NULL;

-- CreateIndex
CREATE INDEX "conversations_businessId_updatedAt_idx" ON "conversations"("businessId", "updatedAt");

-- CreateIndex
CREATE INDEX "conversations_clientId_idx" ON "conversations"("clientId");

-- CreateIndex
CREATE INDEX "messages_conversationId_createdAt_idx" ON "messages"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
