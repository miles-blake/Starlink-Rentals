import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  assertLegalTransition,
  type ReservationStatus,
} from "@/lib/reservation-state-machine";

export class ReservationNotFoundError extends Error {
  constructor() {
    super("Reservation not found.");
    this.name = "ReservationNotFoundError";
  }
}

/**
 * Applies one admin-initiated status transition and its StatusEvent in a
 * single transaction. `data` carries any other fields the specific action
 * needs to set alongside the status change (e.g. amountPaid, actualReturnAt).
 */
export async function applyAdminTransition(params: {
  reservationId: string;
  toStatus: ReservationStatus;
  note?: string;
  data?: Prisma.ReservationUpdateInput;
}) {
  const { reservationId, toStatus, note, data } = params;

  return prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({
      where: { id: reservationId },
    });
    if (!reservation) {
      throw new ReservationNotFoundError();
    }

    assertLegalTransition(reservation.status, toStatus, "admin");

    const updated = await tx.reservation.update({
      where: { id: reservationId },
      data: { status: toStatus, ...data },
    });

    await tx.statusEvent.create({
      data: {
        reservationId,
        fromStatus: reservation.status,
        toStatus,
        actor: "admin",
        note,
      },
    });

    return updated;
  });
}
