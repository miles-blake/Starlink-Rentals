-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('awaiting_payment', 'payment_review', 'confirmed', 'scheduled', 'active', 'returned', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('unpaid', 'deposit_paid', 'paid_in_full', 'refunded', 'partially_refunded');

-- CreateEnum
CREATE TYPE "FulfillmentMethod" AS ENUM ('delivery', 'pickup');

-- CreateEnum
CREATE TYPE "StatusEventActor" AS ENUM ('system', 'admin', 'customer');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('push', 'sms', 'email');

-- CreateEnum
CREATE TYPE "ConditionPhotoPhase" AS ENUM ('dropoff', 'return');

-- CreateEnum
CREATE TYPE "DeliveryFeeModel" AS ENUM ('flat', 'per_mile');

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'awaiting_payment',
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "formattedAddress" TEXT NOT NULL,
    "googlePlaceId" TEXT NOT NULL,
    "distanceMiles" DOUBLE PRECISION NOT NULL,
    "withinRadius" BOOLEAN NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "holdExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "dailyRate" DECIMAL(10,2) NOT NULL,
    "numberOfDays" INTEGER NOT NULL,
    "rentalSubtotal" DECIMAL(10,2) NOT NULL,
    "depositAmount" DECIMAL(10,2) NOT NULL,
    "deliveryFee" DECIMAL(10,2) NOT NULL,
    "totalDue" DECIMAL(10,2) NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'unpaid',
    "venmoReference" TEXT,
    "amountPaid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "paidConfirmedAt" TIMESTAMP(3),
    "depositRefundedAt" TIMESTAMP(3),
    "depositRefundAmount" DECIMAL(10,2),
    "fulfillmentMethod" "FulfillmentMethod",
    "dropoffScheduledAt" TIMESTAMP(3),
    "returnScheduledAt" TIMESTAMP(3),
    "actualReturnAt" TIMESTAMP(3),
    "agreementSignedAt" TIMESTAMP(3),
    "agreementVersion" TEXT,
    "agreementSignerName" TEXT,
    "agreementSignerIp" TEXT,
    "agreementSignerUserAgent" TEXT,
    "agreementTextHash" TEXT,
    "signedPdfUrl" TEXT,
    "internalNotes" TEXT,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlackoutBlock" (
    "id" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlackoutBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactLog" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT,
    "eventType" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "success" BOOLEAN NOT NULL,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConditionPhoto" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "phase" "ConditionPhotoPhase" NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConditionPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusEvent" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "fromStatus" "ReservationStatus",
    "toStatus" "ReservationStatus" NOT NULL,
    "actor" "StatusEventActor" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "otpSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "baseAddress" TEXT NOT NULL,
    "baseLat" DOUBLE PRECISION NOT NULL,
    "baseLng" DOUBLE PRECISION NOT NULL,
    "serviceRadiusMiles" DOUBLE PRECISION NOT NULL DEFAULT 40,
    "dailyRate" DECIMAL(10,2) NOT NULL,
    "depositAmount" DECIMAL(10,2) NOT NULL,
    "deliveryFeeModel" "DeliveryFeeModel" NOT NULL DEFAULT 'flat',
    "deliveryFeeFlat" DECIMAL(10,2),
    "deliveryFeePerMile" DECIMAL(10,2),
    "minRentalDays" INTEGER NOT NULL DEFAULT 1,
    "holdWindowHours" INTEGER NOT NULL DEFAULT 24,
    "venmoUsername" TEXT,
    "contactPhone" TEXT,
    "agreementCurrentVersion" TEXT NOT NULL DEFAULT '1',
    "agreementText" TEXT NOT NULL,
    "cancellationPolicyText" TEXT NOT NULL,
    "notificationChannels" JSONB NOT NULL,
    "notificationEvents" JSONB NOT NULL,
    "quietHours" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_publicId_key" ON "Reservation"("publicId");

-- CreateIndex
CREATE INDEX "Reservation_status_idx" ON "Reservation"("status");

-- CreateIndex
CREATE INDEX "Reservation_startDate_endDate_idx" ON "Reservation"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "Reservation_customerEmail_idx" ON "Reservation"("customerEmail");

-- CreateIndex
CREATE INDEX "BlackoutBlock_startDate_endDate_idx" ON "BlackoutBlock"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "ContactLog_reservationId_idx" ON "ContactLog"("reservationId");

-- CreateIndex
CREATE INDEX "NotificationLog_reservationId_eventType_idx" ON "NotificationLog"("reservationId", "eventType");

-- CreateIndex
CREATE INDEX "ConditionPhoto_reservationId_phase_idx" ON "ConditionPhoto"("reservationId", "phase");

-- CreateIndex
CREATE INDEX "StatusEvent_reservationId_idx" ON "StatusEvent"("reservationId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- AddForeignKey
ALTER TABLE "ContactLog" ADD CONSTRAINT "ContactLog_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConditionPhoto" ADD CONSTRAINT "ConditionPhoto_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusEvent" ADD CONSTRAINT "StatusEvent_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
