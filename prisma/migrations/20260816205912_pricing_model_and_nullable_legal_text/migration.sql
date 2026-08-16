/*
  Warnings:

  - Added the required column `firstDayRate` to the `Reservation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `firstDayRate` to the `Setting` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "firstDayRate" DECIMAL(10,2) NOT NULL;

-- AlterTable
ALTER TABLE "Setting" ADD COLUMN     "firstDayRate" DECIMAL(10,2) NOT NULL,
ALTER COLUMN "agreementText" DROP NOT NULL,
ALTER COLUMN "cancellationPolicyText" DROP NOT NULL;
