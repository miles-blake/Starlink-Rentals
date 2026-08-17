import webpush from "web-push";
import { prisma } from "@/lib/prisma";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    throw new Error("VAPID keys are not configured");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/**
 * Sends to every stored subscription (there's usually just one admin, but
 * the same admin may install the PWA on more than one device). Returns true
 * if at least one send succeeded. Subscriptions the push service reports as
 * gone (410) or not found (404) are pruned automatically.
 */
export async function sendPushToAll(payload: PushPayload): Promise<boolean> {
  ensureConfigured();
  const subscriptions = await prisma.pushSubscription.findMany();
  if (subscriptions.length === 0) return false;

  const outcomes = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload)
        );
      } catch (error) {
        const statusCode =
          error && typeof error === "object" && "statusCode" in error
            ? (error as { statusCode?: number }).statusCode
            : undefined;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription
            .delete({ where: { id: sub.id } })
            .catch(() => {});
        }
        throw error;
      }
    })
  );

  return outcomes.some((outcome) => outcome.status === "fulfilled");
}
