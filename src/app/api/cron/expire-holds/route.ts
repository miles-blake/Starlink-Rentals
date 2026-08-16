import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Formally transitions expired soft holds to cancelled. This is bookkeeping,
 * not the thing that actually keeps the calendar correct: the reservation
 * creation flow (src/app/api/reservations/route.ts) already excludes
 * awaiting_payment rows whose holdExpiresAt has passed when it checks
 * availability, so dates free up in real time regardless of how often this
 * runs. Vercel Hobby plans cap cron jobs at once a day — that's fine here
 * since correctness doesn't depend on it; increase the schedule in
 * vercel.json if you're on Pro and want the admin-facing status to update
 * faster than once a day.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expired = await prisma.reservation.findMany({
    where: {
      status: "awaiting_payment",
      holdExpiresAt: { lt: new Date() },
    },
    select: { id: true },
  });

  if (expired.length === 0) {
    return NextResponse.json({ expiredCount: 0 });
  }

  const ids = expired.map((r) => r.id);

  await prisma.$transaction([
    prisma.reservation.updateMany({
      where: { id: { in: ids } },
      data: { status: "cancelled" },
    }),
    prisma.statusEvent.createMany({
      data: ids.map((id) => ({
        reservationId: id,
        fromStatus: "awaiting_payment",
        toStatus: "cancelled",
        actor: "system",
        note: "Hold expired",
      })),
    }),
  ]);

  return NextResponse.json({ expiredCount: ids.length });
}
