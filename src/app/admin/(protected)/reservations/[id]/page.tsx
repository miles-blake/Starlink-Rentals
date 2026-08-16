import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatCalendarDate,
  formatCurrency,
  formatDateTime,
} from "@/lib/format";
import {
  STATUS_BADGE_CLASSES,
  STATUS_LABELS,
} from "@/lib/reservation-status-display";
import { ReservationActions } from "./reservation-actions";

export const metadata: Metadata = {
  title: "Reservation — Admin",
};

function Field(props: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
        {props.label}
      </div>
      <div className="text-foreground mt-0.5 text-sm">{props.value}</div>
    </div>
  );
}

export default async function ReservationDetailPage({
  params,
}: PageProps<"/admin/reservations/[id]">) {
  const { id } = await params;

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: {
      statusEvents: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!reservation) {
    notFound();
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/admin/reservations"
            className="text-muted-foreground text-sm hover:underline"
          >
            ← Reservations
          </Link>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="text-foreground font-mono text-2xl font-semibold">
              {reservation.publicId}
            </h1>
            <Badge className={STATUS_BADGE_CLASSES[reservation.status]}>
              {STATUS_LABELS[reservation.status]}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Name" value={reservation.customerName} />
              <Field label="Email" value={reservation.customerEmail} />
              <Field label="Phone" value={reservation.customerPhone} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Address & dates</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field
                label="Address"
                value={
                  <>
                    {reservation.formattedAddress}
                    {reservation.addressLine2 && (
                      <>, {reservation.addressLine2}</>
                    )}
                  </>
                }
              />
              <Field
                label="Distance"
                value={`${reservation.distanceMiles.toFixed(1)} mi ${reservation.withinRadius ? "(within radius)" : "(outside radius)"}`}
              />
              <Field
                label="Fulfillment"
                value={reservation.fulfillmentMethod ?? "—"}
              />
              <Field
                label="Rental dates"
                value={`${formatCalendarDate(reservation.startDate)} – ${formatCalendarDate(reservation.endDate)} (${reservation.numberOfDays} day${reservation.numberOfDays === 1 ? "" : "s"})`}
              />
              {reservation.status === "awaiting_payment" &&
                reservation.holdExpiresAt && (
                  <Field
                    label="Hold expires"
                    value={formatDateTime(reservation.holdExpiresAt)}
                  />
                )}
              {reservation.dropoffScheduledAt && (
                <Field
                  label="Drop-off scheduled"
                  value={formatDateTime(reservation.dropoffScheduledAt)}
                />
              )}
              {reservation.returnScheduledAt && (
                <Field
                  label="Return scheduled"
                  value={formatDateTime(reservation.returnScheduledAt)}
                />
              )}
              {reservation.actualReturnAt && (
                <Field
                  label="Actually returned"
                  value={formatDateTime(reservation.actualReturnAt)}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pricing & payment</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field
                label="Rental subtotal"
                value={formatCurrency(Number(reservation.rentalSubtotal))}
              />
              <Field
                label="Delivery fee"
                value={formatCurrency(Number(reservation.deliveryFee))}
              />
              <Field
                label="Deposit"
                value={formatCurrency(Number(reservation.depositAmount))}
              />
              <Field
                label="Total due"
                value={formatCurrency(Number(reservation.totalDue))}
              />
              <Field
                label="Payment status"
                value={reservation.paymentStatus.replace(/_/g, " ")}
              />
              <Field
                label="Amount paid"
                value={formatCurrency(Number(reservation.amountPaid))}
              />
              {reservation.venmoReference && (
                <Field
                  label="Venmo reference"
                  value={reservation.venmoReference}
                />
              )}
              {reservation.paidConfirmedAt && (
                <Field
                  label="Payment confirmed"
                  value={formatDateTime(reservation.paidConfirmedAt)}
                />
              )}
              {reservation.depositRefundedAt && (
                <Field
                  label="Deposit refunded"
                  value={`${formatCurrency(Number(reservation.depositRefundAmount ?? 0))} on ${formatDateTime(reservation.depositRefundedAt)}`}
                />
              )}
            </CardContent>
          </Card>

          {reservation.agreementSignedAt && (
            <Card>
              <CardHeader>
                <CardTitle>Rental agreement</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Field
                  label="Signed by"
                  value={reservation.agreementSignerName}
                />
                <Field
                  label="Signed at"
                  value={formatDateTime(reservation.agreementSignedAt)}
                />
                <Field label="Version" value={reservation.agreementVersion} />
                {reservation.signedPdfUrl && (
                  <Field
                    label="Signed PDF"
                    value={
                      <a
                        href={reservation.signedPdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        View PDF
                      </a>
                    }
                  />
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Status history</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-3">
                {reservation.statusEvents.map((event) => (
                  <li key={event.id} className="text-sm">
                    <span className="text-foreground font-medium">
                      {event.fromStatus
                        ? `${STATUS_LABELS[event.fromStatus]} → ${STATUS_LABELS[event.toStatus]}`
                        : STATUS_LABELS[event.toStatus]}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      · {event.actor} · {formatDateTime(event.createdAt)}
                    </span>
                    {event.note && (
                      <div className="text-muted-foreground">{event.note}</div>
                    )}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <ReservationActions
                reservationId={reservation.id}
                status={reservation.status}
                totalDue={Number(reservation.totalDue)}
                depositAmount={Number(reservation.depositAmount)}
                startDate={reservation.startDate.toISOString()}
                endDate={reservation.endDate.toISOString()}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
