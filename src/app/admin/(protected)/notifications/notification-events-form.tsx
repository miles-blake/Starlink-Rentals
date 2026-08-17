"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NOTIFICATION_EVENTS,
  NOTIFICATION_EVENT_KEYS,
} from "@/lib/notification-events";
import { updateNotificationSettings } from "./actions";

export function NotificationEventsForm(props: {
  initialChannels: { push?: boolean };
  initialEvents: Record<string, boolean>;
  initialQuietHours: { start: string; end: string } | null;
}) {
  const [push, setPush] = useState(props.initialChannels.push !== false);
  const [events, setEvents] = useState<Record<string, boolean>>(
    Object.fromEntries(
      NOTIFICATION_EVENT_KEYS.map((key) => [
        key,
        props.initialEvents[key] !== false,
      ])
    )
  );
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(
    props.initialQuietHours !== null
  );
  const [quietStart, setQuietStart] = useState(
    props.initialQuietHours?.start ?? "22:00"
  );
  const [quietEnd, setQuietEnd] = useState(
    props.initialQuietHours?.end ?? "08:00"
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setError(null);
          const result = await updateNotificationSettings({
            push,
            events,
            quietHours: quietHoursEnabled
              ? { start: quietStart, end: quietEnd }
              : null,
          });
          if (!result.ok) setError(result.error);
          else setSaved(true);
        });
      }}
    >
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={push}
          onChange={(e) => {
            setPush(e.target.checked);
            setSaved(false);
          }}
        />
        <span>Push notifications enabled</span>
      </label>

      <div className="flex flex-col gap-2">
        <Label className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
          Events
        </Label>
        {NOTIFICATION_EVENT_KEYS.map((key) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={events[key]}
              onChange={(e) => {
                setEvents((prev) => ({ ...prev, [key]: e.target.checked }));
                setSaved(false);
              }}
            />
            <span>{NOTIFICATION_EVENTS[key].label}</span>
            {NOTIFICATION_EVENTS[key].priority === "high" && (
              <span className="text-muted-foreground text-xs">
                (high priority — ignores quiet hours)
              </span>
            )}
          </label>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={quietHoursEnabled}
            onChange={(e) => {
              setQuietHoursEnabled(e.target.checked);
              setSaved(false);
            }}
          />
          <span>Quiet hours (UTC)</span>
        </label>
        {quietHoursEnabled && (
          <div className="flex items-center gap-2 pl-6">
            <Input
              type="time"
              value={quietStart}
              onChange={(e) => {
                setQuietStart(e.target.value);
                setSaved(false);
              }}
              className="w-28"
            />
            <span className="text-muted-foreground text-sm">to</span>
            <Input
              type="time"
              value={quietEnd}
              onChange={(e) => {
                setQuietEnd(e.target.value);
                setSaved(false);
              }}
              className="w-28"
            />
          </div>
        )}
        <p className="text-muted-foreground pl-6 text-xs">
          Non-urgent alerts are held during this window. High-priority events
          (payment received, return overdue) send anyway. Times are UTC, not
          your local time.
        </p>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}
      {saved && !error && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">Saved.</p>
      )}

      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
