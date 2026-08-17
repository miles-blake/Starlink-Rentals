-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "otpCodeExpiresAt" TIMESTAMP(3),
ADD COLUMN     "otpCodeHash" TEXT;
