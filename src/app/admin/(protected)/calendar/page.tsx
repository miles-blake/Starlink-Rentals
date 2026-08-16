import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { BLOCKING_STATUSES } from "@/lib/reservation-state-machine";
import { CalendarView } from "./calendar-view";

export const metadata: Metadata = {
  title: "Calendar — Admin",
};

export default async function CalendarPage() {
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - 7);
  const windowEnd = new Date();
  windowEnd.setDate(windowEnd.getDate() + 180);

  const [reservations, blackouts] = await Promise.all([
    prisma.reservation.findMany({
      where: {
        status: { in: BLOCKING_STATUSES },
        startDate: { lt: windowEnd },
        endDate: { gt: windowStart },
      },
      select: {
        publicId: true,
        status: true,
        startDate: true,
        endDate: true,
      },
      orderBy: { startDate: "asc" },
    }),
    prisma.blackoutBlock.findMany({
      orderBy: { startDate: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <span className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
          Calendar
        </span>
        <h1 className="text-foreground mt-1 text-2xl font-semibold">
          Availability
        </h1>
        <p className="text-muted-foreground mt-1 max-w-md text-sm">
          Select a date range to block it off — it takes effect on the public
          site immediately.
        </p>
      </div>

      <CalendarView
        bookedRanges={reservations.map((r) => ({
          publicId: r.publicId,
          status: r.status,
          startDate: r.startDate.toISOString(),
          endDate: r.endDate.toISOString(),
        }))}
        blackouts={blackouts.map((b) => ({
          id: b.id,
          startDate: b.startDate.toISOString(),
          endDate: b.endDate.toISOString(),
          reason: b.reason,
        }))}
      />
    </div>
  );
}
