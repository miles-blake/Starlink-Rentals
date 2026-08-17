"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { formatUsPhone } from "@/lib/format";
import { buildOwnerSmsUrl } from "@/lib/sms-link";

export function TextOwnerLink(props: { publicId: string }) {
  const [contactPhone, setContactPhone] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/contact", { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => setContactPhone(data.contactPhone ?? null))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const smsUrl = contactPhone
    ? buildOwnerSmsUrl(contactPhone, props.publicId)
    : null;

  useEffect(() => {
    if (!smsUrl) return;
    QRCode.toDataURL(smsUrl, { margin: 1, width: 160 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [smsUrl]);

  if (!contactPhone || !smsUrl) return null;

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
      <Button
        variant="outline"
        render={<a href={smsUrl} />}
        nativeButton={false}
      >
        Text the owner
      </Button>
      <div className="hidden flex-col items-center gap-1 sm:flex">
        {qrDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- a data: URL, not an optimizable remote image
          <img
            src={qrDataUrl}
            alt="Scan to text the owner"
            width={96}
            height={96}
          />
        )}
        <span className="text-muted-foreground text-xs">
          {formatUsPhone(contactPhone)}
        </span>
      </div>
    </div>
  );
}
