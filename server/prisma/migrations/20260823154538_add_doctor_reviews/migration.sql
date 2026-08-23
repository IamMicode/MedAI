-- CreateTable
CREATE TABLE "DoctorReview" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DoctorReview_doctorId_idx" ON "DoctorReview"("doctorId");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorReview_doctorId_patientId_key" ON "DoctorReview"("doctorId", "patientId");

-- AddForeignKey
ALTER TABLE "DoctorReview" ADD CONSTRAINT "DoctorReview_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorReview" ADD CONSTRAINT "DoctorReview_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
