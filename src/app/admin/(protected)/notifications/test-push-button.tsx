"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { sendTestPush } from "./actions";

export function TestPushButton() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    kind: "error" | "success";
    text: string;
  } | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        className="self-start"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setMessage(null);
            const result = await sendTestPush();
            setMessage(
              result.ok
                ? { kind: "success", text: "Test notification sent." }
                : { kind: "error", text: result.error }
            );
          })
        }
      >
        {isPending ? "Sending…" : "Send test notification"}
      </Button>
      {message && (
        <p
          className={
            message.kind === "error"
              ? "text-destructive text-sm"
              : "text-sm text-emerald-600 dark:text-emerald-400"
          }
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
