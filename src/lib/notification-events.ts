export type NotificationEventKey =
  | "reservation_signed"
  | "payment_review"
  | "payment_confirmed"
  | "hold_expiring"
  | "hold_expired"
  | "dropoff_today"
  | "return_due_today"
  | "return_overdue"
  | "deposit_refund_pending";

export interface NotificationEventDef {
  label: string;
  priority: "low" | "normal" | "high";
  // High-priority, action-needed events ignore quiet hours.
  quietHoursExempt: boolean;
}

export const NOTIFICATION_EVENTS: Record<
  NotificationEventKey,
  NotificationEventDef
> = {
  reservation_signed: {
    label: "New reservation signed, awaiting payment",
    priority: "normal",
    quietHoursExempt: false,
  },
  payment_review: {
    label: "Renter marked as paid — needs your confirmation",
    priority: "high",
    quietHoursExempt: true,
  },
  payment_confirmed: {
    label: "Payment confirmed (your own action)",
    priority: "low",
    quietHoursExempt: false,
  },
  hold_expiring: {
    label: "Unpaid hold expiring soon",
    priority: "normal",
    quietHoursExempt: false,
  },
  hold_expired: {
    label: "Hold expired, dates freed",
    priority: "normal",
    quietHoursExempt: false,
  },
  dropoff_today: {
    label: "Drop-off scheduled for today",
    priority: "normal",
    quietHoursExempt: false,
  },
  return_due_today: {
    label: "Return due today",
    priority: "high",
    quietHoursExempt: true,
  },
  return_overdue: {
    label: "Return overdue",
    priority: "high",
    quietHoursExempt: true,
  },
  deposit_refund_pending: {
    label: "Deposit refund still pending",
    priority: "normal",
    quietHoursExempt: false,
  },
};

export const NOTIFICATION_EVENT_KEYS = Object.keys(
  NOTIFICATION_EVENTS
) as NotificationEventKey[];
