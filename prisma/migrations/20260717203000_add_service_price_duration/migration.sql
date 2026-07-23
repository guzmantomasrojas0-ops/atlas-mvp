-- AlterTable
ALTER TABLE "services" ADD COLUMN     "durationMinutes" INTEGER NOT NULL,
ADD COLUMN     "price" DECIMAL(10,2) NOT NULL;
