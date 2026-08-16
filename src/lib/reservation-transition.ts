import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  assertLegalTransition,
  type ReservationStatus,
  type StatusEventActor,
} from "@/lib/reservation-state-machine";

export class ReservationNotFoundError extends Error {
  constructor() {
    super("Reservation not found.");
    this.name = "ReservationNotFoundError";
  }
}

/**
 * Applies one status transition and its StatusEvent in a single
 * transaction, for whichever actor is making it (admin, customer, or
 * system). `data` carries any other fields that specific transition needs
 * to set alongside the status change (e.g. amountPaid, actualReturnAt).
 */
export async function applyReservationTransition(params: {
  reservationId: string;
  toStatus: ReservationStatus;
  actor: StatusEventActor;
  note?: string;
  data?: Prisma.ReservationUpdateInput;
}) {
  const { reservationId, toStatus, actor, note, data } = params;

  return prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({
      where: { id: reservationId },
    });
    if (!reservation) {
      throw new ReservationNotFoundError();
    }

    assertLegalTransition(reservation.status, toStatus, actor);

    const updated = await tx.reservation.update({
      where: { id: reservationId },
      data: { status: toStatus, ...data },
    });

    await tx.statusEvent.create({
      data: {
        reservationId,
        fromStatus: reservation.status,
        toStatus,
        actor,
        note,
      },
    });

    return updated;
  });
}
