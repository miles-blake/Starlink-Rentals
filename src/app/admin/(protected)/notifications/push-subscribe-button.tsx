"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { subscribeToPush, unsubscribeFromPush } from "./actions";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}

type SubscriptionState =
  "unsupported" | "loading" | "subscribed" | "unsubscribed";

export function PushSubscribeButton() {
  // Always starts as "loading" on both server and client — feature
  // detection reads `window`/`navigator`, which don't exist during SSR, so
  // computing it eagerly here would render different initial output on the
  // server than on the client and break hydration. The real value is only
  // known once this effect's promise chain resolves, after hydration.
  const [state, setState] = useState<SubscriptionState>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.resolve()
      .then(async () => {
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
          setState("unsupported");
          return;
        }
        const registration = await navigator.serviceWorker.ready;
        const sub = await registration.pushManager.getSubscription();
        setState(sub ? "subscribed" : "unsubscribed");
      })
      .catch(() => setState("unsubscribed"));
  }, []);

  async function handleEnable() {
    setError(null);
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      setError("Push is not configured yet.");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("Notification permission was not granted.");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
      const result = await subscribeToPush(subscription.toJSON());
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setState("subscribed");
    } catch {
      setError("Could not enable notifications on this device.");
    }
  }

  async function handleDisable() {
    setError(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await unsubscribeFromPush(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setState("unsubscribed");
    } catch {
      setError("Could not disable notifications on this device.");
    }
  }

  if (state === "loading") return null;

  if (state === "unsupported") {
    return (
      <p className="text-muted-foreground text-sm">
        This browser doesn&apos;t support push notifications. On iPhone, add
        this app to your Home Screen first (Share → Add to Home Screen), then
        open it from there.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        onClick={state === "subscribed" ? handleDisable : handleEnable}
        variant={state === "subscribed" ? "outline" : "default"}
        className="self-start"
      >
        {state === "subscribed"
          ? "Disable notifications on this device"
          : "Enable notifications on this device"}
      </Button>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
