import { NextResponse } from "next/server";
import { z } from "zod";
import {
  assertMinRentalDays,
  computeQuote,
  MinRentalDaysError,
} from "@/lib/pricing";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";

const bodySchema = z.object({
  numberOfDays: z.number().int().positive(),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  // Cheap DB-only computation, no Google API cost — a looser limit than
  // /api/eligibility is fine, this just guards against pathological abuse.
  if (!checkRateLimit(`pricing:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const settings = await prisma.setting.findUnique({ where: { id: 1 } });
  if (!settings) {
    return NextResponse.json(
      { error: "Service is not configured yet" },
      { status: 503 }
    );
  }

  try {
    assertMinRentalDays(parsed.data.numberOfDays, settings.minRentalDays);
  } catch (error) {
    if (error instanceof MinRentalDaysError) {
      return NextResponse.json(
        { error: error.message, minRentalDays: settings.minRentalDays },
        { status: 422 }
      );
    }
    throw error;
  }

  const quote = computeQuote({
    firstDayRate: Number(settings.firstDayRate),
    dailyRate: Number(settings.dailyRate),
    numberOfDays: parsed.data.numberOfDays,
    depositAmount: Number(settings.depositAmount),
    deliveryFee: 0,
  });

  return NextResponse.json(quote);
}
