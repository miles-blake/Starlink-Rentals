import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { IllegalTransitionError } from "@/lib/reservation-state-machine";
import {
  ReservationNotFoundError,
  applyReservationTransition,
} from "@/lib/reservation-transition";

const bodySchema = z.object({
  publicId: z.string().trim().min(1).max(20),
  email: z.string().trim().email().max(320),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!checkRateLimit(`pay:${ip}`, 10, 10 * 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const reservation = await prisma.reservation.findUnique({
    where: { publicId: parsed.data.publicId.toUpperCase() },
  });

  if (
    !reservation ||
    reservation.customerEmail !== parsed.data.email.toLowerCase()
  ) {
    return NextResponse.json(
      { error: "No reservation found for that code and email." },
      { status: 404 }
    );
  }

  if (!reservation.agreementSignedAt) {
    return NextResponse.json(
      { error: "Please sign the rental agreement before paying." },
      { status: 409 }
    );
  }

  // Idempotent: a double click or page refresh after the transition already
  // happened just re-confirms rather than erroring.
  if (reservation.status !== "awaiting_payment") {
    return NextResponse.json({ status: reservation.status });
  }

  try {
    const updated = await applyReservationTransition({
      reservationId: reservation.id,
      toStatus: "payment_review",
      actor: "customer",
      note: "Customer marked as paid",
    });
    return NextResponse.json({ status: updated.status });
  } catch (error) {
    if (error instanceof ReservationNotFoundError) {
      return NextResponse.json(
        { error: "Reservation not found." },
        { status: 404 }
      );
    }
    if (error instanceof IllegalTransitionError) {
      return NextResponse.json({ status: reservation.status });
    }
    console.error("Mark-as-paid failed", error);
    return NextResponse.json(
      { error: "Could not record your payment. Please try again." },
      { status: 500 }
    );
  }
}
