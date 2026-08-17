import { NextResponse } from "next/server";
import { z } from "zod";
import { findConflicts } from "@/lib/availability";
import { BLOCKING_STATUSES } from "@/lib/reservation-state-machine";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const bodySchema = z
  .object({
    startDate: z.string().regex(DATE_ONLY, "Invalid date"),
    endDate: z.string().regex(DATE_ONLY, "Invalid date"),
  })
  .refine((v) => v.startDate < v.endDate, "endDate must be after startDate");

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

// Informational only — a UX check so the quote step can steer a customer
// away from already-reserved dates before they fill in contact info. The
// real, race-safe enforcement stays server-side in POST /api/reservations
// at creation time, inside a transaction against the same blocking rows.
export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!checkRateLimit(`availability:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const startDate = parseDateOnly(parsed.data.startDate);
  const endDate = parseDateOnly(parsed.data.endDate);

  const [blockingReservations, blackouts] = await Promise.all([
    prisma.reservation.findMany({
      where: {
        OR: [
          {
            status: {
              in: BLOCKING_STATUSES.filter((s) => s !== "awaiting_payment"),
            },
          },
          {
            status: "awaiting_payment",
            holdExpiresAt: { gt: new Date() },
          },
        ],
      },
      select: { id: true, startDate: true, endDate: true },
    }),
    prisma.blackoutBlock.findMany({
      select: { id: true, startDate: true, endDate: true },
    }),
  ]);

  const conflicts = findConflicts({ startDate, endDate }, [
    ...blockingReservations,
    ...blackouts,
  ]);

  return NextResponse.json({ available: conflicts.length === 0 });
}
