import { prisma } from "@/lib/prisma";
import { sendPushToAll } from "@/lib/web-push-channel";
import { isWithinQuietHours, type QuietHours } from "@/lib/quiet-hours";
import {
  NOTIFICATION_EVENTS,
  type NotificationEventKey,
} from "@/lib/notification-events";

/**
 * Single entry point for admin alerts, so callers (Server Actions, API
 * routes, cron) don't care which channel actually delivers them — today
 * that's Web Push only (see Setting.notificationChannels), but the shape
 * here is the seam for adding another channel later without touching call
 * sites. Every call writes a NotificationLog row regardless of whether it
 * actually sent (channel disabled, event disabled, quiet hours) so the
 * settings screen's "why didn't I get this" story stays debuggable.
 */
export async function notify(params: {
  eventType: NotificationEventKey;
  title: string;
  body: string;
  url?: string;
  reservationId?: string;
}): Promise<void> {
  const settings = await prisma.setting.findUnique({ where: { id: 1 } });

  const channels =
    (settings?.notificationChannels as Record<string, boolean> | null) ?? {};
  const events =
    (settings?.notificationEvents as Record<string, boolean> | null) ?? {};

  // Fields default to enabled unless explicitly turned off, so a Setting
  // row that predates a given event key still fires it.
  const pushEnabled = channels.push !== false;
  const eventEnabled = events[params.eventType] !== false;
  const eventDef = NOTIFICATION_EVENTS[params.eventType];
  const quietNow =
    !eventDef.quietHoursExempt &&
    isWithinQuietHours(settings?.quietHours as QuietHours | null);

  const shouldSend = pushEnabled && eventEnabled && !quietNow;

  let success = false;
  if (shouldSend) {
    try {
      success = await sendPushToAll({
        title: params.title,
        body: params.body,
        url: params.url,
      });
    } catch (error) {
      console.error("Push send failed", error);
      success = false;
    }
  }

  await prisma.notificationLog
    .create({
      data: {
        reservationId: params.reservationId,
        eventType: params.eventType,
        channel: "push",
        success,
      },
    })
    .catch((error) => console.error("Failed to write NotificationLog", error));
}
