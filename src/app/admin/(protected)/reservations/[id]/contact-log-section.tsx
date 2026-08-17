"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format";
import { addContactLogNote } from "../actions";

export interface ContactLogRow {
  id: string;
  note: string;
  createdAt: string;
}

export function ContactLogSection(props: {
  reservationId: string;
  customerPhone: string;
  publicId: string;
  initialLogs: ContactLogRow[];
}) {
  const [logs, setLogs] = useState(props.initialLogs);
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const smsUrl = `sms:${props.customerPhone}?&body=${encodeURIComponent(
    `Hi, this is about your Starlink rental ${props.publicId}`
  )}`;

  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        render={<a href={smsUrl} />}
        nativeButton={false}
      >
        Text this renter
      </Button>

      <div className="flex flex-wrap items-end gap-2">
        <Input
          placeholder="Add a note (e.g. texted, confirmed 3pm drop-off)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="min-w-64 flex-1"
        />
        <Button
          size="sm"
          disabled={!note.trim() || isPending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await addContactLogNote(props.reservationId, {
                note: note.trim(),
              });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setLogs((prev) => [
                {
                  id: crypto.randomUUID(),
                  note: note.trim(),
                  createdAt: new Date().toISOString(),
                },
                ...prev,
              ]);
              setNote("");
            })
          }
        >
          Add note
        </Button>
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}

      {logs.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {logs.map((log) => (
            <li key={log.id} className="text-sm">
              <span className="text-foreground">{log.note}</span>{" "}
              <span className="text-muted-foreground text-xs">
                · {formatDateTime(log.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
