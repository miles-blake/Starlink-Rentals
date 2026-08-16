import { NextResponse } from "next/server";
import { z } from "zod";
import { evaluateEligibility } from "@/lib/eligibility";
import { computeDeliveryFee } from "@/lib/pricing";
import {
  fetchDrivingDistanceMiles,
  fetchPlaceDetails,
} from "@/lib/google-maps";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { TtlCache } from "@/lib/ttl-cache";

const bodySchema = z.object({
  placeId: z.string().trim().min(1).max(300),
});

const API_KEY = process.env.GOOGLE_MAPS_SERVER_KEY;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Cached by placeId for a day, per the blueprint's cost-control guidance —
// the base point never changes, so placeId alone is a safe cache key.
const distanceCache = new TtlCache<{
  distanceMiles: number;
  formattedAddress: string;
  lat: number;
  lng: number;
}>(ONE_DAY_MS);

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
    const { distanceMiles } = await distanceCache.getOrSet(
      parsed.data.placeId,
      async () => {
        const place = await fetchPlaceDetails(parsed.data.placeId, API_KEY);
        const distanceMiles = await fetchDrivingDistanceMiles(
          { lat: settings.baseLat, lng: settings.baseLng },
          { lat: place.lat, lng: place.lng },
          API_KEY
        );
        return { distanceMiles, ...place };
      }
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
