import Link from "next/link";
import type { Metadata } from "next";
import { QuoteForm } from "@/components/quote-form";

export const metadata: Metadata = {
  title: "Get a quote — Starlink Rentals",
};

export default function QuotePage() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between px-6 py-6 sm:px-10">
        <Link
          href="/"
          className="text-foreground font-mono text-sm font-medium tracking-tight"
        >
          Starlink Rentals
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center px-6 py-10">
        <div className="mb-8 max-w-md text-center">
          <span className="text-muted-foreground mb-3 inline-block font-mono text-xs tracking-wide uppercase">
            Step 1 of 5 — Quote
          </span>
          <h1 className="text-foreground text-2xl font-semibold">
            Check eligibility and pricing
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Enter your address and dates for an instant, itemized quote.
          </p>
        </div>
        <QuoteForm />
      </main>
    </div>
  );
}
