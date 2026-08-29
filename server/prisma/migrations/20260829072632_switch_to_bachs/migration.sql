/*
  Warnings:

  - You are about to drop the column `flwTransactionId` on the `Payment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "flwTransactionId",
ADD COLUMN     "checkoutId" TEXT,
ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'bachs',
ADD COLUMN     "providerRef" TEXT;
