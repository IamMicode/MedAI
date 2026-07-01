/*
  Warnings:

  - The `smokes` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `alcohol` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `exercises` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "smokes",
ADD COLUMN     "smokes" BOOLEAN,
DROP COLUMN "alcohol",
ADD COLUMN     "alcohol" BOOLEAN,
DROP COLUMN "exercises",
ADD COLUMN     "exercises" BOOLEAN;

-- CreateTable
CREATE TABLE "PanicEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationSeconds" INTEGER,
    "groundingComplete" BOOLEAN NOT NULL DEFAULT false,
    "usedCalmingSound" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PanicEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PanicEvent_userId_createdAt_idx" ON "PanicEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AIUsage_userId_date_idx" ON "AIUsage"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AIUsage_userId_date_key" ON "AIUsage"("userId", "date");

-- AddForeignKey
ALTER TABLE "PanicEvent" ADD CONSTRAINT "PanicEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIUsage" ADD CONSTRAINT "AIUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
