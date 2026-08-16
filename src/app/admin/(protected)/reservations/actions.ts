"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  ReservationNotFoundError,
  applyAdminTransition,
} from "@/lib/admin-reservation-transition";
import { prisma } from "@/lib/prisma";
import { IllegalTransitionError } from "@/lib/reservation-state-machine";
import { requireAdminSession } from "@/lib/require-admin-session";

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
    return applyAdminTransition({
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

  return run(reservationId, () =>
    applyAdminTransition({
      reservationId,
      toStatus: "scheduled",
      note: "Drop-off and return scheduled",
      data: { dropoffScheduledAt, returnScheduledAt },
    })
  );
}

export async function markActive(reservationId: string): Promise<ActionResult> {
  return run(reservationId, () =>
    applyAdminTransition({
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
    applyAdminTransition({
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
    return applyAdminTransition({
      reservationId,
      toStatus: "completed",
      note: `Deposit refund: $${parsed.data.amount.toFixed(2)}`,
      data: {
        depositRefundAmount: parsed.data.amount,
        depositRefundedAt: new Date(),
        paymentStatus: fullRefund ? "refunded" : "partially_refunded",
      },
    });
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
    applyAdminTransition({
      reservationId,
      toStatus: "cancelled",
      note: parsed.data.note || "Cancelled by admin",
    })
  );
}
