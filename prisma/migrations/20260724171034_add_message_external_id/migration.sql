-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "externalMessageId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "messages_externalMessageId_key" ON "messages"("externalMessageId");
