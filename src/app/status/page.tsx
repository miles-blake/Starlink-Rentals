import Link from "next/link";
import type { Metadata } from "next";
import { StatusLookupForm } from "@/components/status-lookup-form";
import { LegalFooter } from "@/components/legal-footer";

export const metadata: Metadata = {
  title: "Check reservation status — Starlink Rentals",
};

export default function StatusPage() {
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
          <h1 className="text-foreground text-2xl font-semibold">
            Check your reservation
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Enter your reservation code and the email you booked with.
          </p>
        </div>
        <StatusLookupForm />
      </main>

      <LegalFooter />
    </div>
  );
}
