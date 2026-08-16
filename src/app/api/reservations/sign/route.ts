import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { z } from "zod";
import { generateSignedAgreementPdf } from "@/lib/agreement-pdf";
import { sendEmail } from "@/lib/email";
import { sha256Hex } from "@/lib/hash";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";

const bodySchema = z.object({
  publicId: z.string().trim().min(1).max(20),
  email: z.string().trim().email().max(320),
  signerName: z.string().trim().min(1).max(200),
});

const SIGNABLE_STATUSES = new Set(["awaiting_payment", "payment_review"]);

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!checkRateLimit(`sign:${ip}`, 10, 10 * 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const reservation = await prisma.reservation.findUnique({
    where: { publicId: parsed.data.publicId.toUpperCase() },
  });

  // Same error for "no such code" and "email doesn't match" as the status
  // lookup endpoint, so this can't be used to probe which codes exist.
  if (
    !reservation ||
    reservation.customerEmail !== parsed.data.email.toLowerCase()
  ) {
    return NextResponse.json(
      { error: "No reservation found for that code and email." },
      { status: 404 }
    );
  }

  // Immutable once signed — return the existing record instead of
  // re-processing, so a duplicate submit (e.g. a double click) is harmless.
  if (reservation.agreementSignedAt) {
    return NextResponse.json({
      signerName: reservation.agreementSignerName,
      signedAt: reservation.agreementSignedAt,
      version: reservation.agreementVersion,
      signedPdfUrl: reservation.signedPdfUrl,
    });
  }

  if (!SIGNABLE_STATUSES.has(reservation.status)) {
    return NextResponse.json(
      {
        error:
          "This reservation is no longer active and can't be signed. Please start a new reservation.",
      },
      { status: 409 }
    );
  }

  const settings = await prisma.setting.findUnique({ where: { id: 1 } });
  if (!settings?.agreementText) {
    return NextResponse.json(
      { error: "Agreement is not configured yet" },
      { status: 503 }
    );
  }

  const signedAt = new Date();
  const textHash = sha256Hex(settings.agreementText);
  const userAgent = request.headers.get("user-agent") ?? "unknown";

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateSignedAgreementPdf({
      text: settings.agreementText,
      version: settings.agreementCurrentVersion,
      signerName: parsed.data.signerName,
      signedAt,
      publicId: reservation.publicId,
      textHash,
    });
  } catch (error) {
    console.error("Signed agreement PDF generation failed", error);
    return NextResponse.json(
      { error: "Could not generate the signed agreement. Please try again." },
      { status: 500 }
    );
  }

  let signedPdfUrl: string;
  try {
    const blob = await put(
      `agreements/${reservation.publicId}-v${settings.agreementCurrentVersion}.pdf`,
      pdfBuffer,
      { access: "private", contentType: "application/pdf" }
    );
    signedPdfUrl = blob.url;
  } catch (error) {
    console.error("Signed agreement Blob upload failed", error);
    return NextResponse.json(
      { error: "Could not store the signed agreement. Please try again." },
      { status: 500 }
    );
  }

  const updated = await prisma.reservation.update({
    where: { id: reservation.id },
    data: {
      agreementSignedAt: signedAt,
      agreementVersion: settings.agreementCurrentVersion,
      agreementSignerName: parsed.data.signerName,
      agreementSignerIp: ip,
      agreementSignerUserAgent: userAgent,
      agreementTextHash: textHash,
      signedPdfUrl,
    },
  });

  try {
    await sendEmail({
      to: reservation.customerEmail,
      subject: `Your signed Starlink Rentals agreement — ${reservation.publicId}`,
      text: `Hi ${parsed.data.signerName},\n\nAttached is your signed copy of the Starlink Rentals rental agreement for reservation ${reservation.publicId}.\n\nThanks,\nStarlink Rentals`,
      attachments: [
        {
          filename: `starlink-rentals-agreement-${reservation.publicId}.pdf`,
          content: pdfBuffer,
        },
      ],
    });
  } catch (error) {
    // Non-fatal: the signature and PDF are already durably stored. Log for
    // now; Phase 6's NotificationLog will give this proper retry/visibility.
    console.error("Signed agreement email failed to send", error);
  }

  return NextResponse.json({
    signerName: updated.agreementSignerName,
    signedAt: updated.agreementSignedAt,
    version: updated.agreementVersion,
    signedPdfUrl: updated.signedPdfUrl,
  });
}
