import type { ReservationStatus } from "@/lib/reservation-state-machine";

export const STATUS_LABELS: Record<ReservationStatus, string> = {
  awaiting_payment: "Awaiting payment",
  payment_review: "Payment review",
  confirmed: "Confirmed",
  scheduled: "Scheduled",
  active: "Active",
  returned: "Returned",
  completed: "Completed",
  cancelled: "Cancelled",
};

// Tailwind classes for a small status pill, one per lifecycle stage.
export const STATUS_BADGE_CLASSES: Record<ReservationStatus, string> = {
  awaiting_payment:
    "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-inset ring-amber-500/20",
  payment_review:
    "bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-inset ring-blue-500/20",
  confirmed:
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-inset ring-emerald-500/20",
  scheduled:
    "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 ring-1 ring-inset ring-cyan-500/20",
  active:
    "bg-violet-500/10 text-violet-600 dark:text-violet-400 ring-1 ring-inset ring-violet-500/20",
  returned:
    "bg-sky-500/10 text-sky-600 dark:text-sky-400 ring-1 ring-inset ring-sky-500/20",
  completed: "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
  cancelled:
    "bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/20",
};

export const ALL_STATUSES: ReservationStatus[] = [
  "awaiting_payment",
  "payment_review",
  "confirmed",
  "scheduled",
  "active",
  "returned",
  "completed",
  "cancelled",
];
