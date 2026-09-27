-- AlterTable
ALTER TABLE "PasswordResetCode" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "resetTokenHash" TEXT,
ADD COLUMN     "verifiedAt" TIMESTAMP(3);
