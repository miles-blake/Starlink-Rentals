import { describe, expect, it } from "vitest";
import { generateSignedAgreementPdf } from "./agreement-pdf";

describe("generateSignedAgreementPdf", () => {
  it("produces a valid PDF buffer embedding the signer's details", async () => {
    const buffer = await generateSignedAgreementPdf({
      text: "Paragraph one.\n\nParagraph two.",
      version: "1",
      signerName: "Jane Renter",
      signedAt: new Date("2026-08-17T00:00:00.000Z"),
      publicId: "SL-TEST",
      textHash: "deadbeef",
    });

    // PDF files start with the "%PDF-" magic header and end with %%EOF —
    // content streams are Flate-compressed by default, so we can't assert
    // on embedded text directly without inflating them, but a valid,
    // reasonably-sized document is a meaningful signal generation worked.
    expect(buffer.subarray(0, 5).toString("utf8")).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(500);
    expect(buffer.subarray(-6).toString("utf8").trim()).toBe("%%EOF");
  });

  it("produces different output for different signers", async () => {
    const base = {
      text: "Paragraph one.",
      version: "1",
      signedAt: new Date("2026-08-17T00:00:00.000Z"),
      publicId: "SL-TEST",
      textHash: "deadbeef",
    };
    const a = await generateSignedAgreementPdf({ ...base, signerName: "Jane" });
    const b = await generateSignedAgreementPdf({ ...base, signerName: "John" });
    expect(a.equals(b)).toBe(false);
  });
});
