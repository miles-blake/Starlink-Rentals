"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ReservationStatus } from "@/lib/reservation-state-machine";
import {
  cancelReservation,
  confirmPayment,
  markActive,
  markReturned,
  refundDeposit,
  scheduleDropoff,
} from "../actions";

// datetime-local wants "YYYY-MM-DDTHH:mm" with no timezone suffix. `date`
// here is one of the reservation's pure calendar dates (UTC midnight) — read
// it back with UTC getters, not local ones, so the default doesn't shift to
// the previous day in any timezone behind UTC.
function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T12:00`;
}

function ActionError({ error }: { error: string | null }) {
  if (!error) return null;
  return <p className="text-destructive text-sm">{error}</p>;
}

export function ReservationActions(props: {
  reservationId: string;
  status: ReservationStatus;
  totalDue: number;
  depositAmount: number;
  startDate: string;
  endDate: string;
}) {
  const { reservationId, status } = props;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const canCancel = [
    "awaiting_payment",
    "payment_review",
    "confirmed",
    "scheduled",
  ].includes(status);

  return (
    <div className="flex flex-col gap-6">
      {status === "awaiting_payment" && (
        <p className="text-muted-foreground text-sm">
          Waiting for the customer to sign and pay. Nothing to do here until
          they mark it paid — this becomes actionable once the status moves to
          &quot;Payment review&quot;.
        </p>
      )}

      {status === "payment_review" && (
        <ConfirmPaymentForm
          reservationId={reservationId}
          defaultAmount={props.totalDue}
          isPending={isPending}
          startTransition={startTransition}
          setError={setError}
        />
      )}

      {status === "confirmed" && (
        <ScheduleForm
          reservationId={reservationId}
          startDate={props.startDate}
          endDate={props.endDate}
          isPending={isPending}
          startTransition={startTransition}
          setError={setError}
        />
      )}

      {status === "scheduled" && (
        <Button
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await markActive(reservationId);
              if (!result.ok) setError(result.error);
            })
          }
        >
          Mark unit handed over (active)
        </Button>
      )}

      {status === "active" && (
        <Button
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await markReturned(reservationId);
              if (!result.ok) setError(result.error);
            })
          }
        >
          Mark returned
        </Button>
      )}

      {status === "returned" && (
        <RefundForm
          reservationId={reservationId}
          defaultAmount={props.depositAmount}
          isPending={isPending}
          startTransition={startTransition}
          setError={setError}
        />
      )}

      {(status === "completed" || status === "cancelled") && (
        <p className="text-muted-foreground text-sm">
          This reservation is closed out — no further actions.
        </p>
      )}

      {canCancel && (
        <CancelForm
          reservationId={reservationId}
          isPending={isPending}
          startTransition={startTransition}
          setError={setError}
        />
      )}

      <ActionError error={error} />
    </div>
  );
}

type FormProps = {
  reservationId: string;
  isPending: boolean;
  startTransition: (fn: () => Promise<void>) => void;
  setError: (error: string | null) => void;
};

function ConfirmPaymentForm({
  reservationId,
  defaultAmount,
  isPending,
  startTransition,
  setError,
}: FormProps & { defaultAmount: number }) {
  const [amount, setAmount] = useState(String(defaultAmount));
  const [venmoReference, setVenmoReference] = useState("");

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-foreground text-sm font-medium">Confirm payment</h3>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
            Amount paid
          </label>
          <Input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-32"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
            Venmo reference (optional)
          </label>
          <Input
            value={venmoReference}
            onChange={(e) => setVenmoReference(e.target.value)}
            className="w-48"
          />
        </div>
        <Button
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await confirmPayment(reservationId, {
                amountPaid: Number(amount),
                venmoReference: venmoReference || undefined,
              });
              if (!result.ok) setError(result.error);
            })
          }
        >
          Confirm payment
        </Button>
      </div>
    </div>
  );
}

function ScheduleForm({
  reservationId,
  startDate,
  endDate,
  isPending,
  startTransition,
  setError,
}: FormProps & { startDate: string; endDate: string }) {
  const [dropoffScheduledAt, setDropoffScheduledAt] = useState(
    toDatetimeLocalValue(new Date(startDate))
  );
  const [returnScheduledAt, setReturnScheduledAt] = useState(
    toDatetimeLocalValue(new Date(endDate))
  );

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-foreground text-sm font-medium">
        Schedule drop-off and return
      </h3>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
            Drop-off
          </label>
          <Input
            type="datetime-local"
            value={dropoffScheduledAt}
            onChange={(e) => setDropoffScheduledAt(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
            Return
          </label>
          <Input
            type="datetime-local"
            value={returnScheduledAt}
            onChange={(e) => setReturnScheduledAt(e.target.value)}
          />
        </div>
        <Button
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await scheduleDropoff(reservationId, {
                dropoffScheduledAt,
                returnScheduledAt,
              });
              if (!result.ok) setError(result.error);
            })
          }
        >
          Schedule
        </Button>
      </div>
    </div>
  );
}

function RefundForm({
  reservationId,
  defaultAmount,
  isPending,
  startTransition,
  setError,
}: FormProps & { defaultAmount: number }) {
  const [amount, setAmount] = useState(String(defaultAmount));

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-foreground text-sm font-medium">Refund deposit</h3>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
            Refund amount
          </label>
          <Input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-32"
          />
        </div>
        <Button
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await refundDeposit(reservationId, {
                amount: Number(amount),
              });
              if (!result.ok) setError(result.error);
            })
          }
        >
          Refund and complete
        </Button>
      </div>
    </div>
  );
}

function CancelForm({
  reservationId,
  isPending,
  startTransition,
  setError,
}: FormProps) {
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button
        variant="destructive"
        size="sm"
        className="self-start"
        onClick={() => setConfirming(true)}
      >
        Cancel reservation
      </Button>
    );
  }

  return (
    <div className="border-destructive/30 flex flex-col gap-3 border-t pt-4">
      <h3 className="text-destructive text-sm font-medium">
        Cancel this reservation?
      </h3>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
            Reason (optional)
          </label>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-64"
          />
        </div>
        <Button
          variant="destructive"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await cancelReservation(reservationId, {
                note: note || undefined,
              });
              if (!result.ok) setError(result.error);
              else setConfirming(false);
            })
          }
        >
          Confirm cancellation
        </Button>
        <Button variant="outline" onClick={() => setConfirming(false)}>
          Never mind
        </Button>
      </div>
    </div>
  );
}
