import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { LegalFooter } from "@/components/legal-footer";

export const metadata: Metadata = {
  title: "Terms & cancellation policy — Starlink Rentals",
};

export default async function TermsPage() {
  const setting = await prisma.setting.findUnique({ where: { id: 1 } });
  const cancellationPolicyText =
    setting?.cancellationPolicyText ??
    "Contact us for current cancellation terms.";

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
        <div className="flex w-full max-w-2xl flex-col gap-8">
          <div>
            <span className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
              Legal
            </span>
            <h1 className="text-foreground mt-1 text-2xl font-semibold">
              Terms of service
            </h1>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              This page is a summary for website visitors. The full,
              legally-binding terms are the Rental Agreement you sign
              electronically when you book, which covers the same ground in
              more detail. This is a draft prepared for the operator&apos;s
              own review and is not a substitute for advice from a lawyer.
            </p>
          </div>

          <section className="flex flex-col gap-2">
            <h2 className="text-foreground text-base font-semibold">
              Who we are
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Starlink Rentals is an independent equipment rental service
              operated by Miles Holt Blake. We are not affiliated with,
              endorsed by, or sponsored by Starlink or SpaceX. We make no
              warranty regarding internet speed, latency, uptime, or
              coverage, since those depend on Starlink&apos;s own network,
              weather, and your location.
            </p>
          </section>

          <section id="cancellation" className="flex flex-col gap-2">
            <h2 className="text-foreground text-base font-semibold">
              Cancellation policy
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">
              {cancellationPolicyText}
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-foreground text-base font-semibold">
              Fees and payment
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Your quote shows the rental fee, refundable deposit, and any
              delivery fee, fixed at the time you book. Payment, including
              the deposit, is due in full before drop-off or pickup. The
              deposit is refunded on return of the equipment in good
              condition, ordinary wear and tear excepted.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-foreground text-base font-semibold">
              Late returns
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Equipment not returned by the scheduled return time is subject
              to a late fee, calculated hourly, as described in your Rental
              Agreement.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-foreground text-base font-semibold">
              Questions
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Text us using the link on your{" "}
              <Link href="/status" className="text-primary hover:underline">
                status page
              </Link>{" "}
              or in your confirmation email, and mention your reservation
              code.
            </p>
          </section>
        </div>
      </main>

      <LegalFooter />
    </div>
  );
}
