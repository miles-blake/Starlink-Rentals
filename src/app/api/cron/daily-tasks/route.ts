import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { textOwnerEmailBlurb } from "@/lib/sms-link";
import { buildIcsEvent } from "@/lib/ics";
import { notify } from "@/lib/notifier";
import type { NotificationChannel } from "@/generated/prisma/client";

/**
 * One consolidated daily cron for every time-based renter/admin
 * notification (Vercel Hobby plans cap cron jobs at 2 total and once a day
 * each, so this stays a single job rather than one per event — see
 * expire-holds/route.ts for the other one). Dedup is per reservation, per
 * event type, per channel, per calendar day via NotificationLog.
 */

async function alreadySentToday(
  reservationId: string,
  eventType: string,
  channel: NotificationChannel
): Promise<boolean> {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const existing = await prisma.notificationLog.findFirst({
    where: { reservationId, eventType, channel, sentAt: { gte: dayStart } },
  });
  return existing !== null;
}

async function logSend(
  reservationId: string,
  eventType: string,
  channel: NotificationChannel,
  success: boolean
) {
  await prisma.notificationLog
    .create({ data: { reservationId, eventType, channel, success } })
    .catch((error) => console.error("Failed to write NotificationLog", error));
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await prisma.setting.findUnique({ where: { id: 1 } });

  const now = new Date();
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const results = {
    returnReminders: 0,
    returnReminderFailures: 0,
    holdExpiring: 0,
    dropoffToday: 0,
    returnDueToday: 0,
    returnOverdue: 0,
    depositRefundPending: 0,
  };

  // --- Renter email: return reminder (day of), with an .ics attachment ---
  const dueToday = await prisma.reservation.findMany({
    where: {
      status: { in: ["scheduled", "active"] },
      returnScheduledAt: { gte: dayStart, lt: dayEnd },
    },
  });

  for (const reservation of dueToday) {
    if (!(await alreadySentToday(reservation.id, "return_reminder", "email"))) {
      try {
        const returnAt = reservation.returnScheduledAt!;
        const returnEnd = new Date(returnAt.getTime() + 60 * 60 * 1000);
        const ics = buildIcsEvent({
          uid: `${reservation.publicId}-return@starlinkrentals`,
          title: `Starlink return — ${reservation.publicId}`,
          description: `Return your Starlink rental equipment for reservation ${reservation.publicId}.`,
          start: returnAt,
          end: returnEnd,
        });
        await sendEmail({
          to: reservation.customerEmail,
          subject: `Return reminder — ${reservation.publicId}`,
          text: `Hi ${reservation.customerName},\n\nJust a reminder that your Starlink rental (${reservation.publicId}) is due back today, ${returnAt.toLocaleString()}.${textOwnerEmailBlurb(settings?.contactPhone ?? null, reservation.publicId)}\n\n— Starlink Rentals`,
          attachments: [
            {
              filename: `starlink-return-${reservation.publicId}.ics`,
              content: Buffer.from(ics, "utf8"),
            },
          ],
        });
        await logSend(reservation.id, "return_reminder", "email", true);
        results.returnReminders += 1;
      } catch (error) {
        console.error("Return reminder email failed", error);
        await logSend(reservation.id, "return_reminder", "email", false);
        results.returnReminderFailures += 1;
      }
    }

    // --- Admin push: return due today (high priority) ---
    if (!(await alreadySentToday(reservation.id, "return_due_today", "push"))) {
      await notify({
        eventType: "return_due_today",
        title: "Return due today",
        body: `${reservation.publicId} (${reservation.customerName}) is due back today.`,
        url: `/admin/reservations/${reservation.id}`,
        reservationId: reservation.id,
      });
      results.returnDueToday += 1;
    }
  }

  // --- Admin push: unpaid hold expiring within 24 hours ---
  const holdSoonThreshold = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const expiringSoon = await prisma.reservation.findMany({
    where: {
      status: "awaiting_payment",
      holdExpiresAt: { gte: now, lte: holdSoonThreshold },
    },
  });
  for (const reservation of expiringSoon) {
    if (await alreadySentToday(reservation.id, "hold_expiring", "push")) {
      continue;
    }
    await notify({
      eventType: "hold_expiring",
      title: "Hold expiring soon",
      body: `${reservation.publicId} is unpaid and its hold expires within 24 hours.`,
      url: `/admin/reservations/${reservation.id}`,
      reservationId: reservation.id,
    });
    results.holdExpiring += 1;
  }

  // --- Admin push: drop-off scheduled for today ---
  const dropoffToday = await prisma.reservation.findMany({
    where: {
      status: "scheduled",
      dropoffScheduledAt: { gte: dayStart, lt: dayEnd },
    },
  });
  for (const reservation of dropoffToday) {
    if (await alreadySentToday(reservation.id, "dropoff_today", "push")) {
      continue;
    }
    await notify({
      eventType: "dropoff_today",
      title: "Drop-off today",
      body: `${reservation.publicId} (${reservation.customerName}) drop-off is scheduled for today.`,
      url: `/admin/reservations/${reservation.id}`,
      reservationId: reservation.id,
    });
    results.dropoffToday += 1;
  }

  // --- Admin push: return overdue (past the scheduled return, not returned) ---
  const overdue = await prisma.reservation.findMany({
    where: {
      status: { in: ["scheduled", "active"] },
      returnScheduledAt: { lt: dayStart },
    },
  });
  for (const reservation of overdue) {
    if (await alreadySentToday(reservation.id, "return_overdue", "push")) {
      continue;
    }
    await notify({
      eventType: "return_overdue",
      title: "Return overdue",
      body: `${reservation.publicId} (${reservation.customerName}) is overdue for return.`,
      url: `/admin/reservations/${reservation.id}`,
      reservationId: reservation.id,
    });
    results.returnOverdue += 1;
  }

  // --- Admin push: deposit refund still pending (returned 2+ days ago) ---
  const refundPendingThreshold = new Date(now);
  refundPendingThreshold.setUTCDate(refundPendingThreshold.getUTCDate() - 2);
  const refundPending = await prisma.reservation.findMany({
    where: {
      status: "returned",
      depositRefundedAt: null,
      actualReturnAt: { lte: refundPendingThreshold },
    },
  });
  for (const reservation of refundPending) {
    if (
      await alreadySentToday(reservation.id, "deposit_refund_pending", "push")
    ) {
      continue;
    }
    await notify({
      eventType: "deposit_refund_pending",
      title: "Deposit refund pending",
      body: `${reservation.publicId} was returned a while ago — deposit refund still pending.`,
      url: `/admin/reservations/${reservation.id}`,
      reservationId: reservation.id,
    });
    results.depositRefundPending += 1;
  }

  return NextResponse.json(results);
}
