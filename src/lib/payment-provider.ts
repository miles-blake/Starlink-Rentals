/**
 * Payment handoff abstraction (see starlink-rental-blueprint.md sections
 * 6 and 16). Today there is one operator-confirmed provider: the renter
 * pays the operator directly via Venmo and an admin manually confirms it
 * (src/app/admin/(protected)/reservations/actions.ts#confirmPayment).
 *
 * A future BraintreeVenmoProvider (Venmo via Braintree's SDK) would
 * implement this same interface to support automated, in-app payment
 * confirmation instead of a manual handoff + admin confirmation step.
 * Swapping it in should require no changes outside this file and whatever
 * calls getHandoffInstructions() — the payment API routes and UI only
 * depend on the shape below, not on Venmo specifically.
 */
export interface PaymentHandoffInstructions {
  method: string;
  recipientHandle: string;
  payUrl: string;
  amount: number;
  reference: string;
  instructions: string;
}

export interface PaymentProvider {
  getHandoffInstructions(params: {
    amount: number;
    reference: string;
  }): PaymentHandoffInstructions;
}

export class ManualVenmoProvider implements PaymentProvider {
  constructor(private readonly venmoUsername: string) {}

  getHandoffInstructions(params: {
    amount: number;
    reference: string;
  }): PaymentHandoffInstructions {
    const { amount, reference } = params;
    const note = `Starlink Rental ${reference}`;
    const payUrl = `https://venmo.com/${encodeURIComponent(this.venmoUsername)}?txn=pay&amount=${amount.toFixed(2)}&note=${encodeURIComponent(note)}`;

    return {
      method: "manual_venmo",
      recipientHandle: `@${this.venmoUsername}`,
      payUrl,
      amount,
      reference,
      instructions: `Send $${amount.toFixed(2)} via Venmo to @${this.venmoUsername} using the button or QR code below, and include "${note}" in the payment note. This uses Venmo's Goods & Services option, so your payment is covered by purchase protection — Venmo may add a small processing fee to the total. Once you've sent it, tap "I have paid" below so we can confirm.`,
    };
  }
}
