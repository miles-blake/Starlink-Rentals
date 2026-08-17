"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PaymentHandoff } from "@/components/payment-handoff";
import { TextOwnerLink } from "@/components/text-owner-link";

interface ReservationStatus {
  publicId: string;
  status: string;
  startDate: string;
  endDate: string;
  numberOfDays: number;
  fulfillmentMethod: "delivery" | "pickup" | null;
  formattedAddress: string;
  rentalSubtotal: number;
  depositAmount: number;
  deliveryFee: number;
  totalDue: number;
  paymentStatus: string;
  holdExpiresAt: string | null;
  dropoffScheduledAt: string | null;
  returnScheduledAt: string | null;
}

type AsyncState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: ReservationStatus };

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const STATUS_LABELS: Record<string, string> = {
  awaiting_payment: "Awaiting payment",
  payment_review: "Payment under review",
  confirmed: "Confirmed",
  scheduled: "Drop-off/pickup scheduled",
  active: "Rental in progress",
  returned: "Returned — processing deposit",
  completed: "Completed",
  cancelled: "Cancelled",
};

function formatUtcDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function StatusLookupForm() {
  const [publicId, setPublicId] = useState("");
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<AsyncState>({ status: "idle" });
  const [paying, setPaying] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult({ status: "loading" });
    try {
      const res = await fetch("/api/reservations/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicId, email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({
          status: "error",
          message: data.error ?? "Could not find that reservation.",
        });
        return;
      }
      setResult({ status: "ready", data });
    } catch {
      setResult({
        status: "error",
        message: "Something went wrong. Try again.",
      });
    }
  }

  if (result.status === "ready" && paying) {
    return (
      <PaymentHandoff
        publicId={result.data.publicId}
        customerEmail={email}
        onPaid={() => {
          setPaying(false);
          setResult((prev) =>
            prev.status === "ready"
              ? { ...prev, data: { ...prev.data, status: "payment_review" } }
              : prev
          );
        }}
      />
    );
  }

  if (result.status === "ready") {
    const r = result.data;
    return (
      <div className="border-border bg-card flex w-full max-w-md flex-col gap-4 rounded-lg border p-6">
        <div>
          <span className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
            {r.publicId}
          </span>
          <h2 className="text-foreground mt-1 text-xl font-semibold">
            {STATUS_LABELS[r.status] ?? r.status}
          </h2>
        </div>
        <div className="border-border flex flex-col gap-2 border-t pt-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Dates</span>
            <span>
              {formatUtcDate(r.startDate)} – {formatUtcDate(r.endDate)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Fulfillment</span>
            <span className="capitalize">{r.fulfillmentMethod}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total due</span>
            <span className="tabular-nums">{currency.format(r.totalDue)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Payment status</span>
            <span className="capitalize">
              {r.paymentStatus.replaceAll("_", " ")}
            </span>
          </div>
          {r.holdExpiresAt && r.status === "awaiting_payment" ? (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Hold expires</span>
              <span>
                {new Date(r.holdExpiresAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>
            </div>
          ) : null}
        </div>
        {r.status === "awaiting_payment" ? (
          <Button type="button" size="sm" onClick={() => setPaying(true)}>
            Pay now
          </Button>
        ) : null}
        <TextOwnerLink publicId={r.publicId} />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setResult({ status: "idle" })}
        >
          Look up another reservation
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-border bg-card flex w-full max-w-md flex-col gap-4 rounded-lg border p-6"
    >
      <div className="flex flex-col gap-1.5">
        <label className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
          Reservation code
        </label>
        <Input
          placeholder="SL-XXXX"
          value={publicId}
          onChange={(e) => setPublicId(e.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
          Email
        </label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      {result.status === "error" ? (
        <p className="text-destructive text-sm">{result.message}</p>
      ) : null}
      <Button type="submit" disabled={result.status === "loading"}>
        {result.status === "loading" ? "Looking up…" : "Check status"}
      </Button>
    </form>
  );
}
