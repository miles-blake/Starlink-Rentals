import { describe, expect, it } from "vitest";
import { ManualVenmoProvider } from "./payment-provider";

describe("ManualVenmoProvider", () => {
  it("builds a Venmo pay URL with the amount and a reference note", () => {
    const provider = new ManualVenmoProvider("Miles-Blake-2");
    const result = provider.getHandoffInstructions({
      amount: 370,
      reference: "SL-ABCD",
    });

    expect(result.method).toBe("manual_venmo");
    expect(result.recipientHandle).toBe("@Miles-Blake-2");
    expect(result.payUrl).toContain("venmo.com/Miles-Blake-2");
    expect(result.payUrl).toContain("amount=370.00");
    expect(result.payUrl).toContain(encodeURIComponent("SL-ABCD"));
    expect(result.instructions).toContain("$370.00");
    expect(result.instructions).toContain("@Miles-Blake-2");
  });

  it("formats cents correctly", () => {
    const provider = new ManualVenmoProvider("testuser");
    const result = provider.getHandoffInstructions({
      amount: 42.5,
      reference: "SL-XYZ",
    });

    expect(result.payUrl).toContain("amount=42.50");
  });
});
