"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";

interface PaymentInstructions {
  method: string;
  recipientHandle: string;
  payUrl: string;
  amount: number;
  reference: string;
  instructions: string;
}

interface InstructionsResponse {
  status: string;
  totalDue: number;
  paymentInstructions: PaymentInstructions | null;
}

type AsyncState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

export function PaymentHandoff(props: {
  publicId: string;
  customerEmail: string;
  onPaid: () => void;
}) {
  const [info, setInfo] = useState<AsyncState<InstructionsResponse>>({
    status: "loading",
  });
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/reservations/payment-instructions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publicId: props.publicId,
            email: props.customerEmail,
          }),
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) {
          setInfo({
            status: "error",
            message: data.error ?? "Could not load payment instructions.",
          });
          return;
        }
        setInfo({ status: "ready", data });
      } catch {
        // Aborted (component unmounted) — nothing to do.
      }
    })();
    return () => controller.abort();
  }, [props.publicId, props.customerEmail]);

  useEffect(() => {
    if (info.status !== "ready" || !info.data.paymentInstructions) return;
    QRCode.toDataURL(info.data.paymentInstructions.payUrl, {
      margin: 1,
      width: 220,
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [info]);

  if (info.status === "loading") {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  if (info.status === "error") {
    return <p className="text-destructive text-sm">{info.message}</p>;
  }

  if (info.data.status === "payment_review") {
    return (
      <div className="flex w-full max-w-md flex-col gap-3">
        <h2 className="text-foreground text-xl font-semibold">
          Payment received
        </h2>
        <p className="text-muted-foreground text-sm">
          We&apos;ve got your payment confirmation and will confirm your
          reservation shortly.
        </p>
      </div>
    );
  }

  if (!info.data.paymentInstructions) {
    return (
      <div className="flex w-full max-w-md flex-col gap-3">
        <h2 className="text-foreground text-xl font-semibold">
          Payment already handled
        </h2>
        <p className="text-muted-foreground text-sm">
          This reservation&apos;s status is &quot;{info.data.status}&quot;.
        </p>
      </div>
    );
  }

  const pi = info.data.paymentInstructions;

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <div>
        <span className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
          Step 4 of 5 — Pay
        </span>
        <h2 className="text-foreground mt-1 text-xl font-semibold">
          Pay via Venmo
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">{pi.instructions}</p>
      </div>

      <div className="flex flex-col items-center gap-3 rounded-lg border p-4">
        {qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a data: URL, not an optimizable remote image
          <img
            src={qrDataUrl}
            alt="Venmo payment QR code"
            width={220}
            height={220}
          />
        ) : (
          <div className="text-muted-foreground flex h-[220px] w-[220px] items-center justify-center text-sm">
            Generating QR code…
          </div>
        )}
        <Button
          size="lg"
          className="w-full"
          render={<a href={pi.payUrl} target="_blank" rel="noreferrer" />}
          nativeButton={false}
        >
          Open Venmo
        </Button>
        <div className="text-muted-foreground w-full text-sm">
          <div className="flex justify-between">
            <span>To</span>
            <span className="text-foreground font-medium">
              {pi.recipientHandle}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Amount</span>
            <span className="text-foreground font-medium">
              ${pi.amount.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Note</span>
            <span className="text-foreground font-medium">
              Starlink Rental {pi.reference}
            </span>
          </div>
        </div>
      </div>

      {markError && <p className="text-destructive text-sm">{markError}</p>}

      <Button
        size="lg"
        variant="outline"
        disabled={marking}
        onClick={async () => {
          setMarking(true);
          setMarkError(null);
          try {
            const res = await fetch("/api/reservations/pay", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                publicId: props.publicId,
                email: props.customerEmail,
              }),
            });
            const data = await res.json();
            if (!res.ok) {
              setMarkError(data.error ?? "Could not record your payment.");
              setMarking(false);
              return;
            }
            props.onPaid();
          } catch {
            setMarkError("Could not record your payment. Try again.");
            setMarking(false);
          }
        }}
      >
        {marking ? "Confirming…" : "I have paid"}
      </Button>
    </div>
  );
}
