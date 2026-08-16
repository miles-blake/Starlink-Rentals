import { NextResponse } from "next/server";
import { z } from "zod";
import { evaluateEligibility } from "@/lib/eligibility";
import { computeDeliveryFee } from "@/lib/pricing";
import { resolvePlaceAndDistance } from "@/lib/place-lookup";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";

const bodySchema = z.object({
  placeId: z.string().trim().min(1).max(300),
});

const API_KEY = process.env.GOOGLE_MAPS_SERVER_KEY;

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!checkRateLimit(`eligibility:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  if (!API_KEY) {
    return NextResponse.json(
      { error: "Eligibility check is not configured" },
      { status: 503 }
    );
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
    const { distanceMiles } = await resolvePlaceAndDistance(
      parsed.data.placeId,
      API_KEY,
      { lat: settings.baseLat, lng: settings.baseLng }
    );

    const { withinRadius } = evaluateEligibility({
      distanceMiles,
      serviceRadiusMiles: settings.serviceRadiusMiles,
    });

    const deliveryFee = computeDeliveryFee({
      fulfillmentMethod: "delivery",
      deliveryFeeModel: settings.deliveryFeeModel,
      deliveryFeeFlat: settings.deliveryFeeFlat
        ? Number(settings.deliveryFeeFlat)
        : null,
      deliveryFeePerMile: settings.deliveryFeePerMile
        ? Number(settings.deliveryFeePerMile)
        : null,
      distanceMiles,
    });

    return NextResponse.json({ withinRadius, distanceMiles, deliveryFee });
  } catch (error) {
    console.error("Eligibility check failed", error);
    return NextResponse.json(
      { error: "Eligibility check failed" },
      { status: 502 }
    );
  }
}
