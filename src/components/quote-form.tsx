"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { numberOfDaysBetween } from "@/lib/pricing";
import { cn } from "@/lib/utils";

interface AddressSuggestion {
  placeId: string;
  text: string;
}

interface EligibilityResponse {
  withinRadius: boolean;
  distanceMiles: number;
  deliveryFee: number;
}

interface PricingResponse {
  firstDayRate: number;
  dailyRate: number;
  numberOfDays: number;
  rentalSubtotal: number;
  depositAmount: number;
  totalDue: number;
}

interface ReservationResponse {
  publicId: string;
  startDate: string;
  endDate: string;
  numberOfDays: number;
  rentalSubtotal: number;
  depositAmount: number;
  deliveryFee: number;
  totalDue: number;
  fulfillmentMethod: "delivery" | "pickup";
  holdExpiresAt: string;
}

type AsyncState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// The server stores/returns pure calendar dates as UTC midnight. Reading
// them back with local getters (or toLocaleDateString) shifts the displayed
// day backward in any timezone behind UTC — read the UTC components instead
// so "Aug 20" sent stays "Aug 20" shown.
function formatUtcDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function QuoteForm() {
  const [addressInput, setAddressInput] = useState("");
  const [addressOpen, setAddressOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [selectedAddress, setSelectedAddress] =
    useState<AddressSuggestion | null>(null);
  const [eligibility, setEligibility] = useState<
    AsyncState<EligibilityResponse>
  >({ status: "idle" });

  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [dateOpen, setDateOpen] = useState(false);
  const [pricing, setPricing] = useState<AsyncState<PricingResponse>>({
    status: "idle",
  });

  const [fulfillmentMethod, setFulfillmentMethod] = useState<
    "delivery" | "pickup"
  >("delivery");

  const [step, setStep] = useState<"quote" | "details" | "confirmed">("quote");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [reservation, setReservation] = useState<
    AsyncState<ReservationResponse>
  >({ status: "idle" });

  const numberOfDays = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return null;
    return numberOfDaysBetween(dateRange.from, dateRange.to);
  }, [dateRange]);

  // Debounced address autocomplete. Suggestions are cleared eagerly in the
  // input's onChange below when the query gets too short — this effect only
  // ever needs to run the fetch, never reset state on the early-out paths.
  useEffect(() => {
    if (selectedAddress && addressInput === selectedAddress.text) return;
    if (addressInput.trim().length < 3) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/places/autocomplete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: addressInput }),
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
      } catch {
        // Ignore aborted/failed lookups — the user is still typing.
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [addressInput, selectedAddress]);

  async function selectAddress(suggestion: AddressSuggestion) {
    setSelectedAddress(suggestion);
    setAddressInput(suggestion.text);
    setSuggestions([]);
    setAddressOpen(false);
    setEligibility({ status: "loading" });
    try {
      const res = await fetch("/api/eligibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId: suggestion.placeId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEligibility({
          status: "error",
          message: data.error ?? "Could not check eligibility.",
        });
        return;
      }
      setEligibility({ status: "ready", data });
      if (!data.withinRadius) setFulfillmentMethod("pickup");
    } catch {
      setEligibility({
        status: "error",
        message: "Could not check eligibility. Try again.",
      });
    }
  }

  const dateRangeError =
    numberOfDays !== null && numberOfDays < 1
      ? "Pick an end date after your start date."
      : null;

  // Nothing to fetch when the range is incomplete or invalid — dateRangeError
  // (derived above, not stored state) covers the message in that case.
  useEffect(() => {
    if (numberOfDays === null || numberOfDays < 1) return;
    const controller = new AbortController();
    (async () => {
      setPricing({ status: "loading" });
      try {
        const res = await fetch("/api/pricing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ numberOfDays }),
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) {
          setPricing({
            status: "error",
            message: data.error ?? "Could not price this rental.",
          });
          return;
        }
        setPricing({ status: "ready", data });
      } catch {
        // Aborted or network error — a newer request may already be in flight.
      }
    })();
    return () => controller.abort();
  }, [numberOfDays]);

  async function submitReservation() {
    if (!selectedAddress || !dateRange?.from || !dateRange?.to) return;
    setReservation({ status: "loading" });
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: selectedAddress.placeId,
          addressLine2: addressLine2.trim() || undefined,
          startDate: formatDateOnly(dateRange.from),
          endDate: formatDateOnly(dateRange.to),
          fulfillmentMethod,
          customerName,
          customerEmail,
          customerPhone,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setReservation({
          status: "error",
          message: data.error ?? "Could not create the reservation.",
        });
        return;
      }
      setReservation({ status: "ready", data });
      setStep("confirmed");
    } catch {
      setReservation({
        status: "error",
        message: "Could not create the reservation. Try again.",
      });
    }
  }

  // Pickup has no distance limit — the 40-mile radius only ever gates
  // delivery. An address outside it still gets a full quote, just without
  // the delivery option.
  const deliveryAvailable =
    eligibility.status === "ready" && eligibility.data.withinRadius;

  const deliveryFee =
    fulfillmentMethod === "pickup" || !deliveryAvailable
      ? 0
      : eligibility.data.deliveryFee;

  const showQuote =
    eligibility.status === "ready" &&
    pricing.status === "ready" &&
    numberOfDays !== null &&
    numberOfDays >= 1;

  if (step === "confirmed" && reservation.status === "ready") {
    const holdExpires = new Date(reservation.data.holdExpiresAt);
    return (
      <div className="border-border bg-card flex w-full max-w-md flex-col gap-4 rounded-lg border p-6">
        <div>
          <span className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
            Reservation held
          </span>
          <h2 className="text-foreground mt-1 font-mono text-2xl font-semibold">
            {reservation.data.publicId}
          </h2>
        </div>
        <p className="text-muted-foreground text-sm">
          Save this code — you&apos;ll use it with your email to check status
          later. Your dates are held until{" "}
          <span className="text-foreground">
            {holdExpires.toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
          , pending payment setup, which isn&apos;t live yet — the operator will
          follow up directly to arrange next steps.
        </p>
        <div className="border-border flex flex-col gap-2 border-t pt-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Dates</span>
            <span>
              {formatUtcDate(reservation.data.startDate)} –{" "}
              {formatUtcDate(reservation.data.endDate)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">
              {reservation.data.fulfillmentMethod === "pickup"
                ? "Pickup"
                : "Delivery"}
            </span>
            <span className="tabular-nums">
              {reservation.data.deliveryFee === 0
                ? "Free"
                : currency.format(reservation.data.deliveryFee)}
            </span>
          </div>
          <div className="border-border mt-1 flex items-center justify-between border-t pt-3 text-base font-semibold">
            <span>Total due</span>
            <span className="tabular-nums">
              {currency.format(reservation.data.totalDue)}
            </span>
          </div>
        </div>
        <Link
          href="/status"
          className="text-muted-foreground hover:text-foreground text-center text-xs"
        >
          Check status later at /status
        </Link>
      </div>
    );
  }

  if (step === "details") {
    return (
      <div className="flex w-full max-w-md flex-col gap-4">
        <button
          type="button"
          onClick={() => setStep("quote")}
          className="text-muted-foreground hover:text-foreground w-fit text-xs"
        >
          ← Back to quote
        </button>
        <div className="border-border bg-card rounded-lg border p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">
              {dateRange?.from && dateRange?.to
                ? `${format(dateRange.from, "MMM d")} – ${format(dateRange.to, "MMM d, yyyy")}`
                : ""}
            </span>
            <span className="font-semibold tabular-nums">
              {pricing.status === "ready"
                ? currency.format(
                    pricing.data.rentalSubtotal +
                      pricing.data.depositAmount +
                      deliveryFee
                  )
                : ""}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
            Full name
          </label>
          <Input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            autoComplete="name"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
            Email
          </label>
          <Input
            type="email"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
            Phone
          </label>
          <Input
            type="tel"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            autoComplete="tel"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
            Apt / unit (optional)
          </label>
          <Input
            value={addressLine2}
            onChange={(e) => setAddressLine2(e.target.value)}
            autoComplete="address-line2"
          />
        </div>

        {reservation.status === "error" ? (
          <p className="text-destructive text-sm">{reservation.message}</p>
        ) : null}

        <Button
          type="button"
          size="lg"
          disabled={
            reservation.status === "loading" ||
            !customerName.trim() ||
            !customerEmail.trim() ||
            !customerPhone.trim()
          }
          onClick={submitReservation}
        >
          {reservation.status === "loading"
            ? "Holding your dates…"
            : "Hold these dates"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
          Delivery or pickup address
        </label>
        <div className="relative">
          <Input
            placeholder="Start typing your address…"
            value={addressInput}
            onChange={(e) => {
              const value = e.target.value;
              setAddressInput(value);
              setSelectedAddress(null);
              setEligibility({ status: "idle" });
              setAddressOpen(true);
              if (value.trim().length < 3) setSuggestions([]);
            }}
            onFocus={() => setAddressOpen(true)}
            onBlur={() => {
              // Let a click on a suggestion register before the list closes.
              setTimeout(() => setAddressOpen(false), 150);
            }}
          />
          {addressOpen && addressInput.trim().length >= 3 ? (
            <div className="border-border bg-popover absolute top-full right-0 left-0 z-50 mt-1 max-h-60 overflow-auto rounded-lg border p-1 text-sm shadow-md">
              {suggestions.length === 0 ? (
                <p className="text-muted-foreground px-2 py-1.5">
                  No matches yet.
                </p>
              ) : (
                suggestions.map((s) => (
                  <button
                    key={s.placeId}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectAddress(s)}
                    className="hover:bg-accent block w-full rounded-md px-2 py-1.5 text-left"
                  >
                    {s.text}
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
        {eligibility.status === "loading" ? (
          <p className="text-muted-foreground text-xs">Checking address…</p>
        ) : null}
        {eligibility.status === "error" ? (
          <p className="text-destructive text-xs">{eligibility.message}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
          Rental dates
        </label>
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                className="w-full justify-start font-normal"
              />
            }
          >
            {dateRange?.from && dateRange?.to
              ? `${format(dateRange.from, "MMM d")} – ${format(dateRange.to, "MMM d, yyyy")}`
              : "Select start and end dates"}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={(range) => {
                setDateRange(range);
                // react-day-picker sets from === to on the first click of a
                // new range — only close once a real (multi-day) range or a
                // deliberate re-click on the same day exists.
                if (
                  range?.from &&
                  range?.to &&
                  range.from.getTime() !== range.to.getTime()
                ) {
                  setDateOpen(false);
                }
              }}
              disabled={{ before: new Date() }}
              numberOfMonths={1}
            />
          </PopoverContent>
        </Popover>
        {dateRangeError ? (
          <p className="text-destructive text-xs">{dateRangeError}</p>
        ) : pricing.status === "error" ? (
          <p className="text-destructive text-xs">{pricing.message}</p>
        ) : null}
      </div>

      {eligibility.status === "ready" ? (
        <div className="flex flex-col gap-2">
          <label className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
            Fulfillment
          </label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={fulfillmentMethod === "delivery" ? "default" : "outline"}
              size="sm"
              disabled={!deliveryAvailable}
              onClick={() => setFulfillmentMethod("delivery")}
              className={cn("flex-1")}
            >
              Delivery
            </Button>
            <Button
              type="button"
              variant={fulfillmentMethod === "pickup" ? "default" : "outline"}
              size="sm"
              onClick={() => setFulfillmentMethod("pickup")}
              className={cn("flex-1")}
            >
              Pickup (free)
            </Button>
          </div>
          {!deliveryAvailable ? (
            <p className="text-muted-foreground text-xs">
              {eligibility.data.distanceMiles} miles is outside our 40-mile
              delivery area, but pickup at our location is always available.
            </p>
          ) : null}
        </div>
      ) : null}

      {showQuote && pricing.status === "ready" ? (
        <div className="border-border bg-card flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Rental — {pricing.data.numberOfDays} day
              {pricing.data.numberOfDays === 1 ? "" : "s"}
            </span>
            <span className="tabular-nums">
              {currency.format(pricing.data.rentalSubtotal)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Deposit (refundable)</span>
            <span className="tabular-nums">
              {currency.format(pricing.data.depositAmount)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {fulfillmentMethod === "pickup" ? "Pickup" : "Delivery"}
            </span>
            <span className="tabular-nums">
              {deliveryFee === 0 ? "Free" : currency.format(deliveryFee)}
            </span>
          </div>
          <div className="border-border mt-1 flex items-center justify-between border-t pt-3 text-base font-semibold">
            <span>Total due</span>
            <span className="tabular-nums">
              {currency.format(
                pricing.data.rentalSubtotal +
                  pricing.data.depositAmount +
                  deliveryFee
              )}
            </span>
          </div>
          <Button
            type="button"
            size="lg"
            className="mt-1"
            onClick={() => setStep("details")}
          >
            Continue
          </Button>
        </div>
      ) : null}
    </div>
  );
}
