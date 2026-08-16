import { NextResponse } from "next/server";
import { z } from "zod";
import { ManualVenmoProvider } from "@/lib/payment-provider";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";

const bodySchema = z.object({
  publicId: z.string().trim().min(1).max(20),
  email: z.string().trim().email().max(320),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!checkRateLimit(`payment-instructions:${ip}`, 30, 10 * 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const reservation = await prisma.reservation.findUnique({
    where: { publicId: parsed.data.publicId.toUpperCase() },
  });

  // Same error for "no such code" and "email doesn't match" as the other
  // customer-facing endpoints, so this can't be used to probe valid codes.
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

  let paymentInstructions = null;
  if (reservation.status === "awaiting_payment") {
    const settings = await prisma.setting.findUnique({ where: { id: 1 } });
    if (!settings?.venmoUsername) {
      return NextResponse.json(
        { error: "Payment is not configured yet" },
        { status: 503 }
      );
    }
    const provider = new ManualVenmoProvider(settings.venmoUsername);
    paymentInstructions = provider.getHandoffInstructions({
      amount: Number(reservation.totalDue),
      reference: reservation.publicId,
    });
  }

  return NextResponse.json({
    status: reservation.status,
    totalDue: Number(reservation.totalDue),
    paymentInstructions,
  });
}
