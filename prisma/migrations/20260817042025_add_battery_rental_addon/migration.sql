-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "batteryFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "batteryRented" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Setting" ADD COLUMN     "batteryDailyRate" DECIMAL(10,2) NOT NULL DEFAULT 10;
