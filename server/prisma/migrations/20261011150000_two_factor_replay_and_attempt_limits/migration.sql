-- Additive only: three new columns on "User". No data is changed, dropped or rewritten,
-- and existing rows get NULL / 0, which the application treats as "no history".
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "twoFactorLastStep" INTEGER,
ADD COLUMN     "twoFactorAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "twoFactorWindowEndsAt" TIMESTAMP(3);
