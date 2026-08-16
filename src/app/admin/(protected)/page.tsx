import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/format";
import {
  ALL_STATUSES,
  STATUS_BADGE_CLASSES,
  STATUS_LABELS,
} from "@/lib/reservation-status-display";
import { BLOCKING_STATUSES } from "@/lib/reservation-state-machine";

const UTILIZATION_WINDOW_DAYS = 30;
const UPCOMING_EVENTS_WINDOW_DAYS = 14;

function clampedOverlapDays(
  rangeStart: Date,
  rangeEnd: Date,
  windowStart: Date,
  windowEnd: Date
): number {
  const start = rangeStart > windowStart ? rangeStart : windowStart;
  const end = rangeEnd < windowEnd ? rangeEnd : windowEnd;
  const ms = end.getTime() - start.getTime();
  return ms > 0 ? Math.round(ms / (1000 * 60 * 60 * 24)) : 0;
}

export default async function AdminDashboardPage() {
  const now = new Date();
  const utilizationWindowEnd = new Date(now);
  utilizationWindowEnd.setDate(
    utilizationWindowEnd.getDate() + UTILIZATION_WINDOW_DAYS
  );
  const eventsWindowEnd = new Date(now);
  eventsWindowEnd.setDate(
    eventsWindowEnd.getDate() + UPCOMING_EVENTS_WINDOW_DAYS
  );
  const holdSoonThreshold = new Date(now);
  holdSoonThreshold.setHours(holdSoonThreshold.getHours() + 24);

  const [
    statusCounts,
    revenueAgg,
    depositsHeldAgg,
    depositsRefundedAgg,
    blockingInWindow,
    upcomingDropoffs,
    upcomingReturns,
    expiringHolds,
  ] = await Promise.all([
    prisma.reservation.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.reservation.aggregate({
      where: {
        status: { notIn: ["awaiting_payment", "payment_review", "cancelled"] },
      },
      _sum: { rentalSubtotal: true, deliveryFee: true },
    }),
    prisma.reservation.aggregate({
      where: {
        status: { in: ["confirmed", "scheduled", "active", "returned"] },
      },
      _sum: { depositAmount: true },
    }),
    prisma.reservation.aggregate({
      where: { status: "completed" },
      _sum: { depositRefundAmount: true },
    }),
    prisma.reservation.findMany({
      where: {
        status: { in: BLOCKING_STATUSES },
        startDate: { lt: utilizationWindowEnd },
        endDate: { gt: now },
      },
      select: { startDate: true, endDate: true },
    }),
    prisma.reservation.findMany({
      where: {
        dropoffScheduledAt: { gte: now, lte: eventsWindowEnd },
      },
      orderBy: { dropoffScheduledAt: "asc" },
      select: {
        id: true,
        publicId: true,
        customerName: true,
        dropoffScheduledAt: true,
      },
    }),
    prisma.reservation.findMany({
      where: {
        returnScheduledAt: { gte: now, lte: eventsWindowEnd },
      },
      orderBy: { returnScheduledAt: "asc" },
      select: {
        id: true,
        publicId: true,
        customerName: true,
        returnScheduledAt: true,
      },
    }),
    prisma.reservation.findMany({
      where: {
        status: "awaiting_payment",
        holdExpiresAt: { lte: holdSoonThreshold },
      },
      orderBy: { holdExpiresAt: "asc" },
      select: {
        id: true,
        publicId: true,
        customerName: true,
        holdExpiresAt: true,
      },
    }),
  ]);

  const countByStatus = Object.fromEntries(
    statusCounts.map((row) => [row.status, row._count._all])
  );

  const bookedDays = blockingInWindow.reduce(
    (sum, r) =>
      sum +
      clampedOverlapDays(r.startDate, r.endDate, now, utilizationWindowEnd),
    0
  );
  const utilizationPct = Math.round(
    (bookedDays / UTILIZATION_WINDOW_DAYS) * 100
  );

  const upcomingEvents = [
    ...upcomingDropoffs.map((r) => ({
      kind: "Drop-off" as const,
      id: r.id,
      publicId: r.publicId,
      customerName: r.customerName,
      at: r.dropoffScheduledAt!,
    })),
    ...upcomingReturns.map((r) => ({
      kind: "Return" as const,
      id: r.id,
      publicId: r.publicId,
      customerName: r.customerName,
      at: r.returnScheduledAt!,
    })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  const rentalRevenue =
    Number(revenueAgg._sum.rentalSubtotal ?? 0) +
    Number(revenueAgg._sum.deliveryFee ?? 0);
  const depositsHeld = Number(depositsHeldAgg._sum.depositAmount ?? 0);
  const depositsRefunded = Number(
    depositsRefundedAgg._sum.depositRefundAmount ?? 0
  );

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <span className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
          Dashboard
        </span>
        <h1 className="text-foreground mt-1 text-2xl font-semibold">
          Overview
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {ALL_STATUSES.map((status) => (
          <Link
            key={status}
            href={`/admin/reservations?status=${status}`}
            className="hover:bg-muted/40 flex flex-col gap-1 rounded-xl border p-4 transition-colors"
          >
            <Badge className={STATUS_BADGE_CLASSES[status]}>
              {STATUS_LABELS[status]}
            </Badge>
            <span className="text-foreground text-2xl font-semibold tabular-nums">
              {countByStatus[status] ?? 0}
            </span>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Rental revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground text-2xl font-semibold tabular-nums">
              {formatCurrency(rentalRevenue)}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Rental + delivery fees for confirmed-or-later, non-cancelled
              reservations. Excludes deposits.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Deposits held</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground text-2xl font-semibold tabular-nums">
              {formatCurrency(depositsHeld)}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Across confirmed, scheduled, active, and returned reservations not
              yet refunded.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Deposits refunded</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground text-2xl font-semibold tabular-nums">
              {formatCurrency(depositsRefunded)}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Across completed reservations.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>
              Utilization (next {UTILIZATION_WINDOW_DAYS} days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground text-2xl font-semibold tabular-nums">
              {utilizationPct}%
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {bookedDays} of {UTILIZATION_WINDOW_DAYS} days booked.
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>
              Upcoming events (next {UPCOMING_EVENTS_WINDOW_DAYS} days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingEvents.length === 0 && (
              <p className="text-muted-foreground text-sm">
                Nothing scheduled.
              </p>
            )}
            <ul className="flex flex-col gap-2">
              {upcomingEvents.map((event) => (
                <li key={`${event.kind}-${event.id}`} className="text-sm">
                  <Link
                    href={`/admin/reservations/${event.id}`}
                    className="text-foreground hover:underline"
                  >
                    {event.kind} · {event.publicId}
                  </Link>
                  <div className="text-muted-foreground text-xs">
                    {event.customerName} · {formatDateTime(event.at)}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Holds expiring soon</CardTitle>
          </CardHeader>
          <CardContent>
            {expiringHolds.length === 0 && (
              <p className="text-muted-foreground text-sm">None.</p>
            )}
            <ul className="flex flex-col gap-2">
              {expiringHolds.map((r) => (
                <li key={r.id} className="text-sm">
                  <Link
                    href={`/admin/reservations/${r.id}`}
                    className="text-foreground hover:underline"
                  >
                    {r.publicId}
                  </Link>
                  <div className="text-muted-foreground text-xs">
                    {r.customerName} · expires{" "}
                    {formatDateTime(r.holdExpiresAt!)}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
