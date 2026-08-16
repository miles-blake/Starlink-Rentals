/**
 * Single source of truth for legal reservation status transitions. See
 * starlink-rental-blueprint.md section 5 for the full lifecycle diagram.
 * Every transition (however it's triggered) must go through
 * assertLegalTransition so illegal ones are rejected consistently and every
 * caller writes the same shape of StatusEvent.
 */

export type ReservationStatus =
  | "awaiting_payment"
  | "payment_review"
  | "confirmed"
  | "scheduled"
  | "active"
  | "returned"
  | "completed"
  | "cancelled";

export type StatusEventActor = "system" | "admin" | "customer";

interface TransitionRule {
  from: ReservationStatus;
  to: ReservationStatus;
  actor: StatusEventActor;
}

const TRANSITIONS: TransitionRule[] = [
  // Customer taps "I have paid" (Phase 5).
  { from: "awaiting_payment", to: "payment_review", actor: "customer" },
  // Hold expiry cron, and admin cancelling before payment.
  { from: "awaiting_payment", to: "cancelled", actor: "system" },
  { from: "awaiting_payment", to: "cancelled", actor: "admin" },
  // Admin confirms or rejects the claimed payment.
  { from: "payment_review", to: "confirmed", actor: "admin" },
  { from: "payment_review", to: "cancelled", actor: "admin" },
  // Admin schedules drop-off/pickup, or cancels before it happens.
  { from: "confirmed", to: "scheduled", actor: "admin" },
  { from: "confirmed", to: "cancelled", actor: "admin" },
  // Admin cancels a scheduled rental, or hands over the unit.
  { from: "scheduled", to: "cancelled", actor: "admin" },
  { from: "scheduled", to: "active", actor: "admin" },
  // Admin marks the unit returned.
  { from: "active", to: "returned", actor: "admin" },
  // Admin refunds the deposit, closing out the rental.
  { from: "returned", to: "completed", actor: "admin" },
];

export class IllegalTransitionError extends Error {
  constructor(
    public readonly from: ReservationStatus,
    public readonly to: ReservationStatus,
    public readonly actor: StatusEventActor
  ) {
    super(`Cannot transition from "${from}" to "${to}" as ${actor}.`);
    this.name = "IllegalTransitionError";
  }
}

export function isLegalTransition(
  from: ReservationStatus,
  to: ReservationStatus,
  actor: StatusEventActor
): boolean {
  return TRANSITIONS.some(
    (rule) => rule.from === from && rule.to === to && rule.actor === actor
  );
}

export function assertLegalTransition(
  from: ReservationStatus,
  to: ReservationStatus,
  actor: StatusEventActor
): void {
  if (!isLegalTransition(from, to, actor)) {
    throw new IllegalTransitionError(from, to, actor);
  }
}

export function legalNextStatuses(
  from: ReservationStatus,
  actor: StatusEventActor
): ReservationStatus[] {
  return TRANSITIONS.filter(
    (rule) => rule.from === from && rule.actor === actor
  ).map((rule) => rule.to);
}

/** Statuses that hold a spot on the calendar (see availability.ts). */
export const BLOCKING_STATUSES: ReservationStatus[] = [
  "awaiting_payment",
  "payment_review",
  "confirmed",
  "scheduled",
  "active",
  "returned",
];
