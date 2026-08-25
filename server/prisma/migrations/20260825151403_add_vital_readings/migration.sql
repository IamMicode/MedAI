-- CreateTable
CREATE TABLE "VitalReading" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "heartRate" TEXT,
    "spo2" TEXT,
    "temp" TEXT,
    "bp" TEXT,
    "glucose" TEXT,
    "weight" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VitalReading_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VitalReading_userId_idx" ON "VitalReading"("userId");

-- AddForeignKey
ALTER TABLE "VitalReading" ADD CONSTRAINT "VitalReading_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
