"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/require-admin-session";
import { sendPushToAll } from "@/lib/web-push-channel";
import { NOTIFICATION_EVENT_KEYS } from "@/lib/notification-events";

type ActionResult = { ok: true } | { ok: false; error: string };

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function subscribeToPush(
  subscription: unknown
): Promise<ActionResult> {
  const parsed = subscriptionSchema.safeParse(subscription);
  if (!parsed.success) {
    return { ok: false, error: "Invalid subscription." };
  }

  try {
    await requireAdminSession();
    await prisma.pushSubscription.upsert({
      where: { endpoint: parsed.data.endpoint },
      update: { p256dh: parsed.data.keys.p256dh, auth: parsed.data.keys.auth },
      create: {
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
      },
    });
    return { ok: true };
  } catch (error) {
    console.error("Push subscribe failed", error);
    return { ok: false, error: "Could not save subscription." };
  }
}

export async function unsubscribeFromPush(
  endpoint: string
): Promise<ActionResult> {
  try {
    await requireAdminSession();
    await prisma.pushSubscription
      .delete({ where: { endpoint } })
      .catch(() => {});
    return { ok: true };
  } catch (error) {
    console.error("Push unsubscribe failed", error);
    return { ok: false, error: "Could not remove subscription." };
  }
}

const quietHoursSchema = z
  .object({
    start: z.string().regex(/^\d{1,2}:\d{2}$/),
    end: z.string().regex(/^\d{1,2}:\d{2}$/),
  })
  .nullable();

const updateSchema = z.object({
  push: z.boolean(),
  events: z.record(z.string(), z.boolean()),
  quietHours: quietHoursSchema,
});

export async function updateNotificationSettings(
  input: z.input<typeof updateSchema>
): Promise<ActionResult> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid settings." };
  }

  const events = Object.fromEntries(
    NOTIFICATION_EVENT_KEYS.map((key) => [
      key,
      parsed.data.events[key] !== false,
    ])
  );

  try {
    await requireAdminSession();
    await prisma.setting.update({
      where: { id: 1 },
      data: {
        notificationChannels: { push: parsed.data.push },
        notificationEvents: events,
        quietHours: parsed.data.quietHours ?? Prisma.JsonNull,
      },
    });
    revalidatePath("/admin/notifications");
    return { ok: true };
  } catch (error) {
    console.error("Update notification settings failed", error);
    return { ok: false, error: "Could not save settings." };
  }
}

export async function sendTestPush(): Promise<ActionResult> {
  try {
    await requireAdminSession();
    const success = await sendPushToAll({
      title: "Test notification",
      body: "Push notifications are working.",
      url: "/admin",
    });
    if (!success) {
      return {
        ok: false,
        error:
          "No push reached a device. Make sure notifications are enabled below.",
      };
    }
    return { ok: true };
  } catch (error) {
    console.error("Test push failed", error);
    return { ok: false, error: "Could not send a test notification." };
  }
}
