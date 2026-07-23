-- AlterEnum
ALTER TYPE "ConversationChannel" ADD VALUE 'FACEBOOK_MESSENGER';

-- CreateTable
CREATE TABLE "channel_mappings" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "channel" "ConversationChannel" NOT NULL,
    "externalConversationId" TEXT NOT NULL,
    "externalUserId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "channel_mappings_conversationId_key" ON "channel_mappings"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "channel_mappings_businessId_channel_externalConversationId_key" ON "channel_mappings"("businessId", "channel", "externalConversationId");

-- AddForeignKey
ALTER TABLE "channel_mappings" ADD CONSTRAINT "channel_mappings_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_mappings" ADD CONSTRAINT "channel_mappings_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
