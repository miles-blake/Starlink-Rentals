"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createBlackout, deleteBlackout } from "./actions";

export interface BookedRange {
  publicId: string;
  status: string;
  startDate: string;
  endDate: string;
}

export interface BlackoutRow {
  id: string;
  startDate: string;
  endDate: string;
  reason: string | null;
}

function formatDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// The server sends pure calendar dates as UTC-midnight ISO strings, but
// react-day-picker (and date-fns' format()) work in the browser's local
// timezone. Re-anchor to local midnight on the same Y/M/D so day-matching
// and formatting downstream don't shift by a day in timezones behind UTC.
function calendarDateFromIso(iso: string): Date {
  const d = new Date(iso);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

// Ranges are half-open [start, end) — the day a rental ends is already free
// for the next one, so shrink the visual highlight by a day to match.
function toInclusiveDisplayRange(
  startDate: string,
  endDate: string
): DateRange {
  const from = calendarDateFromIso(startDate);
  const to = calendarDateFromIso(endDate);
  to.setDate(to.getDate() - 1);
  return { from, to: to < from ? from : to };
}

export function CalendarView(props: {
  bookedRanges: BookedRange[];
  blackouts: BlackoutRow[];
}) {
  const [newRange, setNewRange] = useState<DateRange | undefined>();
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const bookedModifier = props.bookedRanges.map((r) =>
    toInclusiveDisplayRange(r.startDate, r.endDate)
  );
  const blackoutModifier = props.blackouts.map((b) =>
    toInclusiveDisplayRange(b.startDate, b.endDate)
  );

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="flex flex-col gap-3">
        <Calendar
          mode="range"
          numberOfMonths={2}
          selected={newRange}
          onSelect={setNewRange}
          disabled={{ before: new Date() }}
          modifiers={{ booked: bookedModifier, blackout: blackoutModifier }}
          modifiersClassNames={{
            booked: "ring-1 ring-inset ring-amber-500/50",
            blackout: "bg-destructive/15 text-destructive",
          }}
        />
        <div className="flex flex-wrap gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm ring-1 ring-amber-500/50 ring-inset" />
            Booked
          </span>
          <span className="flex items-center gap-1.5">
            <span className="bg-destructive/15 size-3 rounded-sm" />
            Blackout
          </span>
          <span className="flex items-center gap-1.5">
            <span className="bg-primary size-3 rounded-sm" />
            Selected (new blackout)
          </span>
        </div>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-3 rounded-lg border p-4">
          <h3 className="text-foreground text-sm font-medium">
            Add blackout block
          </h3>
          <p className="text-muted-foreground text-sm">
            {newRange?.from && newRange?.to
              ? `${format(newRange.from, "MMM d")} – ${format(newRange.to, "MMM d, yyyy")}`
              : "Select a date range on the calendar."}
          </p>
          <Input
            placeholder="Reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button
            disabled={!newRange?.from || !newRange?.to || isPending}
            onClick={() => {
              if (!newRange?.from || !newRange?.to) return;
              // A single blacked-out day still needs a half-open [start,
              // end) pair — the picker's inclusive "to" needs +1 day.
              const endExclusive = new Date(newRange.to);
              endExclusive.setDate(endExclusive.getDate() + 1);
              startTransition(async () => {
                setError(null);
                const result = await createBlackout({
                  startDate: formatDateOnly(newRange.from!),
                  endDate: formatDateOnly(endExclusive),
                  reason: reason || undefined,
                });
                if (!result.ok) setError(result.error);
                else {
                  setNewRange(undefined);
                  setReason("");
                }
              });
            }}
          >
            Add blackout
          </Button>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-foreground text-sm font-medium">
            Blackout blocks
          </h3>
          {props.blackouts.length === 0 && (
            <p className="text-muted-foreground text-sm">None scheduled.</p>
          )}
          {props.blackouts.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
            >
              <div>
                <div className="text-foreground">
                  {(() => {
                    const displayRange = toInclusiveDisplayRange(
                      b.startDate,
                      b.endDate
                    );
                    return `${format(displayRange.from!, "MMM d")} – ${format(displayRange.to!, "MMM d, yyyy")}`;
                  })()}
                </div>
                {b.reason && (
                  <div className="text-muted-foreground text-xs">
                    {b.reason}
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    setError(null);
                    const result = await deleteBlackout(b.id);
                    if (!result.ok) setError(result.error);
                  })
                }
              >
                Delete
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
