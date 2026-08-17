import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";

const bodySchema = z.object({
  publicId: z.string().trim().min(1).max(20),
  email: z.string().trim().email().max(320),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!checkRateLimit(`lookup:${ip}`, 20, 10 * 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const reservation = await prisma.reservation.findUnique({
    where: { publicId: parsed.data.publicId.toUpperCase() },
  });

  // Same error for "no such code" and "email doesn't match" — don't let
  // this endpoint be used to probe whether a public code exists.
  if (
    !reservation ||
    reservation.customerEmail !== parsed.data.email.toLowerCase()
  ) {
    return NextResponse.json(
      { error: "No reservation found for that code and email." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    publicId: reservation.publicId,
    status: reservation.status,
    startDate: reservation.startDate,
    endDate: reservation.endDate,
    numberOfDays: reservation.numberOfDays,
    fulfillmentMethod: reservation.fulfillmentMethod,
    formattedAddress: reservation.formattedAddress,
    rentalSubtotal: Number(reservation.rentalSubtotal),
    depositAmount: Number(reservation.depositAmount),
    deliveryFee: Number(reservation.deliveryFee),
    batteryRented: reservation.batteryRented,
    batteryFee: Number(reservation.batteryFee),
    totalDue: Number(reservation.totalDue),
    paymentStatus: reservation.paymentStatus,
    holdExpiresAt: reservation.holdExpiresAt,
    dropoffScheduledAt: reservation.dropoffScheduledAt,
    returnScheduledAt: reservation.returnScheduledAt,
  });
}
