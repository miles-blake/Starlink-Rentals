"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AgreementResponse {
  text: string;
  version: string;
}

interface SignResponse {
  signerName: string;
  signedAt: string;
  version: string;
  signedPdfUrl: string | null;
}

type AsyncState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

export function AgreementSignForm(props: {
  publicId: string;
  customerEmail: string;
  customerName: string;
  onSigned: (result: SignResponse) => void;
}) {
  const [agreement, setAgreement] = useState<AsyncState<AgreementResponse>>({
    status: "loading",
  });
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [signerName, setSignerName] = useState(props.customerName);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/agreement", {
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) {
          setAgreement({
            status: "error",
            message: data.error ?? "Could not load the agreement.",
          });
          return;
        }
        setAgreement({ status: "ready", data });
      } catch {
        // Aborted (component unmounted) — nothing to do.
      }
    })();
    return () => controller.abort();
  }, []);

  // If the text is short enough to fit without scrolling, there's nothing
  // to scroll through — treat it as already read rather than trap the user.
  useEffect(() => {
    if (agreement.status !== "ready") return;
    const el = scrollRef.current;
    if (el && el.scrollHeight <= el.clientHeight + 4) {
      setHasScrolledToBottom(true);
    }
  }, [agreement.status]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    if (atBottom) setHasScrolledToBottom(true);
  }

  async function handleSign() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/reservations/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicId: props.publicId,
          email: props.customerEmail,
          signerName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? "Could not sign the agreement.");
        setSubmitting(false);
        return;
      }
      props.onSigned(data);
    } catch {
      setSubmitError("Could not sign the agreement. Try again.");
      setSubmitting(false);
    }
  }

  if (agreement.status === "loading") {
    return <p className="text-muted-foreground text-sm">Loading agreement…</p>;
  }

  if (agreement.status === "error") {
    return <p className="text-destructive text-sm">{agreement.message}</p>;
  }

  const canSign =
    hasScrolledToBottom && agreedToTerms && signerName.trim().length > 0;

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <div>
        <span className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
          Step 3 of 5 — Sign
        </span>
        <h2 className="text-foreground mt-1 text-xl font-semibold">
          Rental agreement
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Scroll to the bottom to continue.
        </p>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        data-testid="agreement-scroll-box"
        className="border-border bg-card h-72 overflow-y-auto rounded-lg border p-4 text-sm whitespace-pre-wrap"
      >
        {agreement.data.text}
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={agreedToTerms}
          disabled={!hasScrolledToBottom}
          onChange={(e) => setAgreedToTerms(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          I have read and agree to the Rental Agreement above (version{" "}
          {agreement.data.version}).
        </span>
      </label>

      <div className="flex flex-col gap-1.5">
        <label className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
          Type your full name to sign
        </label>
        <Input
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
          disabled={!hasScrolledToBottom}
        />
      </div>

      {submitError ? (
        <p className="text-destructive text-sm">{submitError}</p>
      ) : null}

      <Button
        type="button"
        size="lg"
        disabled={!canSign || submitting}
        onClick={handleSign}
      >
        {submitting ? "Signing…" : "Sign"}
      </Button>
    </div>
  );
}
