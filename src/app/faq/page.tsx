import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Setup guide & FAQ — Starlink Rentals",
};

function Question(props: { q: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h2 className="text-foreground text-base font-semibold">{props.q}</h2>
      <div className="text-muted-foreground text-sm leading-relaxed">
        {props.children}
      </div>
    </div>
  );
}

export default function FaqPage() {
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
              Setup guide
            </span>
            <h1 className="text-foreground mt-1 text-2xl font-semibold">
              Getting set up & frequently asked questions
            </h1>
          </div>

          <div className="flex flex-col gap-6">
            <Question q="What's in the kit?">
              One Starlink dish, one Starlink router, a mounting tripod or base,
              a power cable, and an ethernet cable if you need a wired
              connection. Everything you need to get online — no extra purchases
              required.
            </Question>

            <Question q="How do I set it up?">
              <ol className="list-decimal space-y-1 pl-5">
                <li>
                  Place the dish outside with a clear view of the sky — avoid
                  trees, roofs, or walls directly overhead. The included base
                  lets it stand on the ground, a deck, or a flat roof.
                </li>
                <li>Connect the dish to the router with the included cable.</li>
                <li>Plug the router into power.</li>
                <li>
                  Download the Starlink app (iOS or Android) and follow the
                  in-app pairing steps — it will guide you through checking for
                  obstructions and confirming you have a clear view of the sky.
                </li>
                <li>
                  Once connected, join the Wi-Fi network shown in the app from
                  your phone, laptop, or other devices.
                </li>
              </ol>
            </Question>

            <Question q="How long does it take to get online?">
              Usually a few minutes once the dish has a clear view of the sky
              and finds satellites. The Starlink app shows live setup progress
              and will flag any obstructions.
            </Question>

            <Question q="What if I don't have a clear view of the sky?">
              Try a different spot — a driveway, yard, deck, or rooftop often
              works better than a spot near trees or under eaves. The Starlink
              app&apos;s obstruction check will tell you if your chosen location
              will work before you commit to it.
            </Question>

            <Question q="What do I do if something isn't working?">
              Text us — see the button on your{" "}
              <Link href="/status" className="text-primary hover:underline">
                status page
              </Link>{" "}
              or in your emails, and mention your reservation code. We&apos;ll
              help troubleshoot or arrange a swap if needed.
            </Question>

            <Question q="How do I return the equipment?">
              Have everything (dish, router, cables, mounting base) ready by
              your scheduled return time. Pack it the way it arrived if
              possible. We&apos;ll confirm condition and refund your deposit
              shortly after.
            </Question>

            <Question q="What if I damage or lose something?">
              The refundable deposit covers ordinary repair or replacement
              costs. See your rental agreement for the full terms — text us if
              anything happens so we can sort it out together.
            </Question>

            <Question q="Can I extend my rental?">
              Text us before your return date and we&apos;ll see what we can do,
              depending on availability for the following days.
            </Question>
          </div>

          <p className="text-muted-foreground text-center text-xs">
            Starlink Rentals is an independent rental service and is not
            affiliated with, endorsed by, or sponsored by Starlink or SpaceX.
          </p>
        </div>
      </main>
    </div>
  );
}
