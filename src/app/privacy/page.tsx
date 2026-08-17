import Link from "next/link";
import type { Metadata } from "next";
import { LegalFooter } from "@/components/legal-footer";

export const metadata: Metadata = {
  title: "Privacy — Starlink Rentals",
};

function Section(props: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-foreground text-base font-semibold">{props.title}</h2>
      <div className="text-muted-foreground text-sm leading-relaxed">
        {props.children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
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
              Privacy
            </h1>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              This is a plain description of what we collect and why, drafted
              for the operator&apos;s own review — not a substitute for advice
              from a lawyer.
            </p>
          </div>

          <Section title="What we collect">
            <ul className="list-disc space-y-1 pl-5">
              <li>Your name, email, and phone number, given when you book.</li>
              <li>
                Your delivery or pickup address, resolved and validated through
                the Google Maps Platform.
              </li>
              <li>
                Your rental dates, quote, and payment reference, tied to your
                reservation.
              </li>
              <li>
                Your electronic signature on the Rental Agreement — typed name,
                timestamp, IP address, and browser — as required for it to be
                legally binding.
              </li>
              <li>
                Photos of the equipment&apos;s condition at drop-off and return,
                taken by the operator.
              </li>
            </ul>
          </Section>

          <Section title="What we use it for">
            Fulfilling your reservation: confirming eligibility and pricing,
            coordinating delivery or pickup, processing payment and deposit
            refund, sending status and reminder emails, and resolving any issues
            with the equipment.
          </Section>

          <Section title="Who we share it with">
            We use a small number of service providers to run the business:
            Google Maps Platform (address lookup), Venmo (payment), Resend
            (transactional email), and Vercel (hosting, database, and file
            storage for photos and signed agreements). We don&apos;t sell your
            information or share it for advertising.
          </Section>

          <Section title="How long we keep it">
            Reservation records, signed agreements, and condition photos are
            kept for our own recordkeeping and in case of a dispute. Contact us
            if you&apos;d like your information removed once your rental is
            complete and any dispute window has passed.
          </Section>

          <Section title="Questions">
            Text us using the link on your{" "}
            <Link href="/status" className="text-primary hover:underline">
              status page
            </Link>{" "}
            or in your confirmation email, and mention your reservation code.
          </Section>
        </div>
      </main>

      <LegalFooter />
    </div>
  );
}
