import { NextResponse } from "next/server";
import { z } from "zod";
import { findConflicts } from "@/lib/availability";
import { evaluateEligibility } from "@/lib/eligibility";
import { BLOCKING_STATUSES } from "@/lib/reservation-state-machine";
import {
  MinRentalDaysError,
  assertMinRentalDays,
  computeQuote,
  numberOfDaysBetween,
} from "@/lib/pricing";
import { computeDeliveryFee } from "@/lib/pricing";
import { resolvePlaceAndDistance } from "@/lib/place-lookup";
import { generateUniquePublicId } from "@/lib/public-id";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const bodySchema = z.object({
  placeId: z.string().trim().min(1).max(300),
  addressLine2: z.string().trim().max(100).optional(),
  startDate: z.string().regex(DATE_ONLY, "Invalid date"),
  endDate: z.string().regex(DATE_ONLY, "Invalid date"),
  fulfillmentMethod: z.enum(["delivery", "pickup"]),
  customerName: z.string().trim().min(1).max(200),
  customerEmail: z.string().trim().email().max(320),
  customerPhone: z.string().trim().min(7).max(30),
});

const API_KEY = process.env.GOOGLE_MAPS_SERVER_KEY;

class AvailabilityConflictError extends Error {}

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  // Tighter than /api/eligibility and /api/pricing — this endpoint writes,
  // and a booking spam run is more costly than a quote lookup.
  if (!checkRateLimit(`reservations:${ip}`, 5, 10 * 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  if (!API_KEY) {
    return NextResponse.json(
      { error: "Booking is not configured" },
      { status: 503 }
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const settings = await prisma.setting.findUnique({ where: { id: 1 } });
  if (!settings) {
    return NextResponse.json(
      { error: "Service is not configured yet" },
      { status: 503 }
    );
  }

  const startDate = parseDateOnly(input.startDate);
  const endDate = parseDateOnly(input.endDate);
  const numberOfDays = numberOfDaysBetween(startDate, endDate);

  try {
    assertMinRentalDays(numberOfDays, settings.minRentalDays);
  } catch (error) {
    if (error instanceof MinRentalDaysError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    throw error;
  }

  // Re-resolve address and distance server-side rather than trusting
  // whatever the client last saw from /api/eligibility — a client could
  // have gone stale or been tampered with.
  let place;
  try {
    place = await resolvePlaceAndDistance(input.placeId, API_KEY, {
      lat: settings.baseLat,
      lng: settings.baseLng,
    });
  } catch (error) {
    console.error("Address lookup failed during reservation create", error);
    return NextResponse.json(
      { error: "Could not verify this address. Please try again." },
      { status: 502 }
    );
  }

  const { withinRadius } = evaluateEligibility({
    distanceMiles: place.distanceMiles,
    serviceRadiusMiles: settings.serviceRadiusMiles,
  });

  // Pickup has no distance limit; delivery is capped at the service radius.
  if (input.fulfillmentMethod === "delivery" && !withinRadius) {
    return NextResponse.json(
      {
        error:
          "Delivery isn't available for this address — it's outside our delivery area. Pickup is still available.",
      },
      { status: 422 }
    );
  }

  if (!place.addressLine1 || !place.city || !place.state || !place.zip) {
    return NextResponse.json(
      {
        error:
          "Please select a more specific address (with a street number) from the suggestions.",
      },
      { status: 422 }
    );
  }

  const deliveryFee = computeDeliveryFee({
    fulfillmentMethod: input.fulfillmentMethod,
    deliveryFeeModel: settings.deliveryFeeModel,
    deliveryFeeFlat: settings.deliveryFeeFlat
      ? Number(settings.deliveryFeeFlat)
      : null,
    deliveryFeePerMile: settings.deliveryFeePerMile
      ? Number(settings.deliveryFeePerMile)
      : null,
    distanceMiles: place.distanceMiles,
  });

  const quote = computeQuote({
    firstDayRate: Number(settings.firstDayRate),
    dailyRate: Number(settings.dailyRate),
    numberOfDays,
    depositAmount: Number(settings.depositAmount),
    deliveryFee,
  });

  try {
    const reservation = await prisma.$transaction(async (tx) => {
      // Fetch every currently-blocking row and decide overlap with the
      // same tested logic as src/lib/availability.test.ts, rather than
      // re-encoding the boundary conditions a second time in SQL.
      const [blockingReservations, blackouts] = await Promise.all([
        tx.reservation.findMany({
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
        tx.blackoutBlock.findMany({
          select: { id: true, startDate: true, endDate: true },
        }),
      ]);

      const conflicts = findConflicts({ startDate, endDate }, [
        ...blockingReservations,
        ...blackouts,
      ]);
      if (conflicts.length > 0) {
        throw new AvailabilityConflictError();
      }

      const publicId = await generateUniquePublicId(async (code) => {
        const existing = await tx.reservation.findUnique({
          where: { publicId: code },
          select: { id: true },
        });
        return existing !== null;
      });

      const holdExpiresAt = new Date(
        Date.now() + settings.holdWindowHours * 60 * 60 * 1000
      );

      return tx.reservation.create({
        data: {
          publicId,
          status: "awaiting_payment",
          customerName: input.customerName,
          customerEmail: input.customerEmail.toLowerCase(),
          customerPhone: input.customerPhone,
          addressLine1: place.addressLine1!,
          addressLine2: input.addressLine2 || place.addressLine2,
          city: place.city!,
          state: place.state!,
          zip: place.zip!,
          lat: place.lat,
          lng: place.lng,
          formattedAddress: place.formattedAddress,
          googlePlaceId: input.placeId,
          distanceMiles: place.distanceMiles,
          withinRadius,
          startDate,
          endDate,
          holdExpiresAt,
          firstDayRate: quote.firstDayRate,
          dailyRate: quote.dailyRate,
          numberOfDays: quote.numberOfDays,
          rentalSubtotal: quote.rentalSubtotal,
          depositAmount: quote.depositAmount,
          deliveryFee: quote.deliveryFee,
          totalDue: quote.totalDue,
          fulfillmentMethod: input.fulfillmentMethod,
          statusEvents: {
            create: {
              toStatus: "awaiting_payment",
              actor: "customer",
              note: "Reservation submitted",
            },
          },
        },
      });
    });

    return NextResponse.json(
      {
        publicId: reservation.publicId,
        startDate: reservation.startDate,
        endDate: reservation.endDate,
        numberOfDays: quote.numberOfDays,
        rentalSubtotal: quote.rentalSubtotal,
        depositAmount: quote.depositAmount,
        deliveryFee: quote.deliveryFee,
        totalDue: quote.totalDue,
        fulfillmentMethod: reservation.fulfillmentMethod,
        holdExpiresAt: reservation.holdExpiresAt,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AvailabilityConflictError) {
      return NextResponse.json(
        {
          error:
            "Those dates are no longer available. Please pick different dates.",
        },
        { status: 409 }
      );
    }
    console.error("Reservation creation failed", error);
    return NextResponse.json(
      { error: "Could not create the reservation. Please try again." },
      { status: 500 }
    );
  }
}
