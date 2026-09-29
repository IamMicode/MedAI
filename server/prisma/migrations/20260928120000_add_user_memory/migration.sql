-- CreateTable
CREATE TABLE "UserMemoryFact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fact" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserMemoryFact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserMemoryFact_userId_idx" ON "UserMemoryFact"("userId");

-- AddForeignKey
ALTER TABLE "UserMemoryFact" ADD CONSTRAINT "UserMemoryFact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
