import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCalendarDate, formatCurrency } from "@/lib/format";
import {
  ALL_STATUSES,
  STATUS_BADGE_CLASSES,
  STATUS_LABELS,
} from "@/lib/reservation-status-display";
import type { ReservationStatus } from "@/lib/reservation-state-machine";
import type { Prisma } from "@/generated/prisma/client";

export const metadata: Metadata = {
  title: "Reservations — Admin",
};

type SortKey = "created_desc" | "created_asc" | "start_asc" | "start_desc";

const SORT_OPTIONS: Record<
  SortKey,
  { label: string; orderBy: Prisma.ReservationOrderByWithRelationInput }
> = {
  created_desc: { label: "Newest first", orderBy: { createdAt: "desc" } },
  created_asc: { label: "Oldest first", orderBy: { createdAt: "asc" } },
  start_asc: {
    label: "Start date, soonest first",
    orderBy: { startDate: "asc" },
  },
  start_desc: {
    label: "Start date, latest first",
    orderBy: { startDate: "desc" },
  },
};

export default async function ReservationsPage({
  searchParams,
}: PageProps<"/admin/reservations">) {
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : "";
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const sortKey: SortKey =
    typeof params.sort === "string" && params.sort in SORT_OPTIONS
      ? (params.sort as SortKey)
      : "created_desc";

  const where: Prisma.ReservationWhereInput = {};
  if (status && ALL_STATUSES.includes(status as ReservationStatus)) {
    where.status = status as ReservationStatus;
  }
  if (q) {
    where.OR = [
      { customerName: { contains: q, mode: "insensitive" } },
      { customerEmail: { contains: q, mode: "insensitive" } },
      { publicId: { contains: q.toUpperCase() } },
    ];
  }

  const reservations = await prisma.reservation.findMany({
    where,
    orderBy: SORT_OPTIONS[sortKey].orderBy,
    take: 200,
  });

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <span className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
          Reservations
        </span>
        <h1 className="text-foreground mt-1 text-2xl font-semibold">
          {reservations.length} reservation
          {reservations.length === 1 ? "" : "s"}
        </h1>
      </div>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 border-b pb-6"
      >
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="q"
            className="text-muted-foreground font-mono text-xs tracking-wide uppercase"
          >
            Search
          </label>
          <Input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Name, email, or code"
            className="w-56"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="status"
            className="text-muted-foreground font-mono text-xs tracking-wide uppercase"
          >
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status}
            className="border-input dark:bg-input/30 h-8 rounded-lg border bg-transparent px-2.5 text-sm outline-none"
          >
            <option value="">All</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="sort"
            className="text-muted-foreground font-mono text-xs tracking-wide uppercase"
          >
            Sort
          </label>
          <select
            id="sort"
            name="sort"
            defaultValue={sortKey}
            className="border-input dark:bg-input/30 h-8 rounded-lg border bg-transparent px-2.5 text-sm outline-none"
          >
            {Object.entries(SORT_OPTIONS).map(([key, opt]) => (
              <option key={key} value={key}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" size="sm">
          Apply
        </Button>
        {(status || q || sortKey !== "created_desc") && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            render={<Link href="/admin/reservations" />}
            nativeButton={false}
          >
            Clear
          </Button>
        )}
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-muted-foreground border-b font-mono text-xs tracking-wide uppercase">
              <th className="py-2 pr-4 font-medium">Code</th>
              <th className="py-2 pr-4 font-medium">Customer</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 pr-4 font-medium">Dates</th>
              <th className="py-2 pr-4 font-medium">Method</th>
              <th className="py-2 pr-4 text-right font-medium">Total</th>
              <th className="py-2 pr-4 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {reservations.map((r) => (
              <tr
                key={r.id}
                className="border-border/60 hover:bg-muted/40 border-b last:border-0"
              >
                <td className="py-2.5 pr-4">
                  <Link
                    href={`/admin/reservations/${r.id}`}
                    className="text-foreground font-mono font-medium hover:underline"
                  >
                    {r.publicId}
                  </Link>
                </td>
                <td className="py-2.5 pr-4">
                  <div className="text-foreground">{r.customerName}</div>
                  <div className="text-muted-foreground text-xs">
                    {r.customerEmail}
                  </div>
                </td>
                <td className="py-2.5 pr-4">
                  <Badge className={STATUS_BADGE_CLASSES[r.status]}>
                    {STATUS_LABELS[r.status]}
                  </Badge>
                </td>
                <td className="py-2.5 pr-4 whitespace-nowrap">
                  {formatCalendarDate(r.startDate)} –{" "}
                  {formatCalendarDate(r.endDate)}
                </td>
                <td className="text-muted-foreground py-2.5 pr-4 capitalize">
                  {r.fulfillmentMethod ?? "—"}
                </td>
                <td className="py-2.5 pr-4 text-right tabular-nums">
                  {formatCurrency(Number(r.totalDue))}
                </td>
                <td className="text-muted-foreground py-2.5 pr-4 whitespace-nowrap">
                  {formatCalendarDate(r.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {reservations.length === 0 && (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No reservations match this filter.
          </p>
        )}
      </div>
    </div>
  );
}
