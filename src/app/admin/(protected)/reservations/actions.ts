"use server";

import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";
import { z } from "zod";
import {
  ReservationNotFoundError,
  applyReservationTransition,
} from "@/lib/reservation-transition";
import { prisma } from "@/lib/prisma";
import { IllegalTransitionError } from "@/lib/reservation-state-machine";
import { requireAdminSession } from "@/lib/require-admin-session";
import { sendEmail } from "@/lib/email";
import { textOwnerEmailBlurb } from "@/lib/sms-link";
import { buildIcsEvent } from "@/lib/ics";
import { notify } from "@/lib/notifier";

type ActionResult = { ok: true } | { ok: false; error: string };

async function run(
  reservationId: string,
  action: () => Promise<unknown>
): Promise<ActionResult> {
  try {
    await requireAdminSession();
    await action();
    revalidatePath("/admin/reservations");
    revalidatePath(`/admin/reservations/${reservationId}`);
    revalidatePath("/admin");
    return { ok: true };
  } catch (error) {
    if (error instanceof ReservationNotFoundError) {
      return { ok: false, error: "Reservation not found." };
    }
    if (error instanceof IllegalTransitionError) {
      return {
        ok: false,
        error: `This reservation is no longer in a state that allows that action (currently "${error.from}").`,
      };
    }
    if (error instanceof Error && error.name === "UnauthorizedError") {
      return { ok: false, error: "Not signed in." };
    }
    console.error("Admin reservation action failed", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

async function getReservationOrThrow(reservationId: string) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
  });
  if (!reservation) throw new ReservationNotFoundError();
  return reservation;
}

async function getContactPhone(): Promise<string | null> {
  const settings = await prisma.setting.findUnique({ where: { id: 1 } });
  return settings?.contactPhone ?? null;
}

const confirmPaymentSchema = z.object({
  amountPaid: z.coerce.number().positive(),
  venmoReference: z.string().trim().max(200).optional(),
});

export async function confirmPayment(
  reservationId: string,
  input: { amountPaid: number; venmoReference?: string }
): Promise<ActionResult> {
  const parsed = confirmPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid payment amount." };
  }

  return run(reservationId, async () => {
    const reservation = await getReservationOrThrow(reservationId);
    const paidInFull = parsed.data.amountPaid >= Number(reservation.totalDue);
    const updated = await applyReservationTransition({
      actor: "admin",
      reservationId,
      toStatus: "confirmed",
      note: parsed.data.venmoReference
        ? `Payment confirmed (ref: ${parsed.data.venmoReference})`
        : "Payment confirmed",
      data: {
        amountPaid: parsed.data.amountPaid,
        venmoReference: parsed.data.venmoReference || undefined,
        paidConfirmedAt: new Date(),
        paymentStatus: paidInFull ? "paid_in_full" : "deposit_paid",
      },
    });

    // Best-effort — the payment is already durably confirmed either way.
    try {
      const contactPhone = await getContactPhone();
      await sendEmail({
        to: reservation.customerEmail,
        subject: `Payment confirmed — ${reservation.publicId}`,
        text: `Hi ${reservation.customerName},\n\nWe've confirmed your payment of $${parsed.data.amountPaid.toFixed(2)} for reservation ${reservation.publicId}. Your rental is now confirmed for ${reservation.startDate.toDateString()} to ${reservation.endDate.toDateString()}.\n\nWe'll be in touch to schedule drop-off. You can check your reservation status anytime at the status page using your code and email.\n\n— Starlink Rentals${textOwnerEmailBlurb(contactPhone, reservation.publicId)}`,
      });
    } catch (error) {
      console.error("Payment confirmation email failed", error);
    }

    await notify({
      eventType: "payment_confirmed",
      title: "Reservation confirmed",
      body: `${reservation.publicId} is confirmed — payment of $${parsed.data.amountPaid.toFixed(2)} recorded.`,
      url: `/admin/reservations/${reservationId}`,
      reservationId,
    });

    return updated;
  });
}

const scheduleSchema = z.object({
  dropoffScheduledAt: z.string().min(1),
  returnScheduledAt: z.string().min(1),
});

export async function scheduleDropoff(
  reservationId: string,
  input: { dropoffScheduledAt: string; returnScheduledAt: string }
): Promise<ActionResult> {
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Pick both a drop-off and return time." };
  }
  const dropoffScheduledAt = new Date(parsed.data.dropoffScheduledAt);
  const returnScheduledAt = new Date(parsed.data.returnScheduledAt);
  if (
    isNaN(dropoffScheduledAt.getTime()) ||
    isNaN(returnScheduledAt.getTime())
  ) {
    return { ok: false, error: "Invalid date/time." };
  }

  return run(reservationId, async () => {
    const reservation = await getReservationOrThrow(reservationId);
    const updated = await applyReservationTransition({
      actor: "admin",
      reservationId,
      toStatus: "scheduled",
      note: "Drop-off and return scheduled",
      data: { dropoffScheduledAt, returnScheduledAt },
    });

    try {
      const contactPhone = await getContactPhone();
      const returnEnd = new Date(returnScheduledAt.getTime() + 60 * 60 * 1000);
      const ics = buildIcsEvent({
        uid: `${reservation.publicId}-return@starlinkrentals`,
        title: `Starlink return — ${reservation.publicId}`,
        description: `Return your Starlink rental equipment for reservation ${reservation.publicId}.`,
        start: returnScheduledAt,
        end: returnEnd,
      });
      await sendEmail({
        to: reservation.customerEmail,
        subject: `Drop-off scheduled — ${reservation.publicId}`,
        text: `Hi ${reservation.customerName},\n\nYour ${reservation.fulfillmentMethod === "pickup" ? "pickup" : "delivery"} is scheduled for ${dropoffScheduledAt.toLocaleString()}, and your return is due by ${returnScheduledAt.toLocaleString()}. We've attached a calendar file for the return date.\n\nSetup guide & FAQ: ${process.env.NEXTAUTH_URL}/faq${textOwnerEmailBlurb(contactPhone, reservation.publicId)}\n\n— Starlink Rentals`,
        attachments: [
          {
            filename: `starlink-return-${reservation.publicId}.ics`,
            content: Buffer.from(ics, "utf8"),
          },
        ],
      });
    } catch (error) {
      console.error("Drop-off scheduled email failed", error);
    }

    return updated;
  });
}

export async function markActive(reservationId: string): Promise<ActionResult> {
  return run(reservationId, () =>
    applyReservationTransition({
      actor: "admin",
      reservationId,
      toStatus: "active",
      note: "Unit handed to customer",
    })
  );
}

const returnSchema = z.object({
  actualReturnAt: z.string().min(1).optional(),
});

export async function markReturned(
  reservationId: string,
  input?: { actualReturnAt?: string }
): Promise<ActionResult> {
  const parsed = returnSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { ok: false, error: "Invalid return time." };
  }
  const actualReturnAt = parsed.data.actualReturnAt
    ? new Date(parsed.data.actualReturnAt)
    : new Date();
  if (isNaN(actualReturnAt.getTime())) {
    return { ok: false, error: "Invalid return time." };
  }

  return run(reservationId, () =>
    applyReservationTransition({
      actor: "admin",
      reservationId,
      toStatus: "returned",
      note: "Unit returned",
      data: { actualReturnAt },
    })
  );
}

const refundSchema = z.object({
  amount: z.coerce.number().nonnegative(),
});

export async function refundDeposit(
  reservationId: string,
  input: { amount: number }
): Promise<ActionResult> {
  const parsed = refundSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid refund amount." };
  }

  return run(reservationId, async () => {
    const reservation = await getReservationOrThrow(reservationId);
    const fullRefund = parsed.data.amount >= Number(reservation.depositAmount);
    const updated = await applyReservationTransition({
      actor: "admin",
      reservationId,
      toStatus: "completed",
      note: `Deposit refund: $${parsed.data.amount.toFixed(2)}`,
      data: {
        depositRefundAmount: parsed.data.amount,
        depositRefundedAt: new Date(),
        paymentStatus: fullRefund ? "refunded" : "partially_refunded",
      },
    });

    try {
      const contactPhone = await getContactPhone();
      await sendEmail({
        to: reservation.customerEmail,
        subject: `Deposit refunded — ${reservation.publicId}`,
        text: `Hi ${reservation.customerName},\n\nYour deposit of $${parsed.data.amount.toFixed(2)} for reservation ${reservation.publicId} has been refunded. Thanks for renting with us!${textOwnerEmailBlurb(contactPhone, reservation.publicId)}\n\n— Starlink Rentals`,
      });
    } catch (error) {
      console.error("Deposit refund email failed", error);
    }

    return updated;
  });
}

const cancelSchema = z.object({
  note: z.string().trim().max(500).optional(),
});

export async function cancelReservation(
  reservationId: string,
  input?: { note?: string }
): Promise<ActionResult> {
  const parsed = cancelSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { ok: false, error: "Invalid note." };
  }

  return run(reservationId, () =>
    applyReservationTransition({
      actor: "admin",
      reservationId,
      toStatus: "cancelled",
      note: parsed.data.note || "Cancelled by admin",
    })
  );
}

const contactLogSchema = z.object({
  note: z.string().trim().min(1).max(500),
});

export async function addContactLogNote(
  reservationId: string,
  input: { note: string }
): Promise<ActionResult> {
  const parsed = contactLogSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a note." };
  }

  return run(reservationId, async () => {
    await getReservationOrThrow(reservationId);
    await prisma.contactLog.create({
      data: { reservationId, note: parsed.data.note },
    });
  });
}

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export async function uploadConditionPhoto(
  reservationId: string,
  formData: FormData
): Promise<ActionResult> {
  const file = formData.get("file");
  const phase = formData.get("phase");

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a photo to upload." };
  }
  if (phase !== "dropoff" && phase !== "return") {
    return { ok: false, error: "Invalid phase." };
  }
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "Please upload an image file." };
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return { ok: false, error: "Photo is too large (max 8MB)." };
  }

  return run(reservationId, async () => {
    const reservation = await getReservationOrThrow(reservationId);
    const buffer = Buffer.from(await file.arrayBuffer());
    const extension = file.type.split("/")[1] ?? "jpg";
    const blob = await put(
      `condition-photos/${reservation.publicId}-${phase}-${Date.now()}.${extension}`,
      buffer,
      { access: "private", contentType: file.type }
    );
    await prisma.conditionPhoto.create({
      data: { reservationId, phase, url: blob.url },
    });
  });
}
