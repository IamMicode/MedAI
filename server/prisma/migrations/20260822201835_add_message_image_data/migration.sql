-- AlterTable
ALTER TABLE "DoctorProfile" ADD COLUMN     "formattedAddress" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "imageData" TEXT;
