import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PushSubscribeButton } from "./push-subscribe-button";
import { TestPushButton } from "./test-push-button";
import { NotificationEventsForm } from "./notification-events-form";

export const metadata: Metadata = {
  title: "Notifications — Admin",
};

export default async function NotificationsPage() {
  const settings = await prisma.setting.findUnique({ where: { id: 1 } });

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <span className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
          Notifications
        </span>
        <h1 className="text-foreground mt-1 text-2xl font-semibold">
          Push notifications
        </h1>
        <p className="text-muted-foreground mt-1 max-w-md text-sm">
          Alerts come from this installed app via Web Push — no third-party
          service. On iPhone: add this app to your Home Screen first (Share →
          Add to Home Screen), then open it from there before enabling.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>This device</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <PushSubscribeButton />
          <TestPushButton />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Events & quiet hours</CardTitle>
        </CardHeader>
        <CardContent>
          <NotificationEventsForm
            initialChannels={
              (settings?.notificationChannels as { push?: boolean } | null) ??
              {}
            }
            initialEvents={
              (settings?.notificationEvents as Record<
                string,
                boolean
              > | null) ?? {}
            }
            initialQuietHours={
              (settings?.quietHours as { start: string; end: string } | null) ??
              null
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
