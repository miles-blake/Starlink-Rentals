import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="relative flex min-h-full flex-1 flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]"
      >
        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:64px_64px] opacity-40" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-6 py-6 sm:px-10">
        <span className="text-foreground font-mono text-sm font-medium tracking-tight">
          Starlink Rentals
        </span>
        <Button
          render={<Link href="/admin/login" />}
          nativeButton={false}
          variant="outline"
          size="sm"
        >
          Admin
        </Button>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
        <span className="border-border bg-card text-muted-foreground mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-xs tracking-wide uppercase">
          <span className="bg-primary size-1.5 rounded-full" />
          Serving 40 miles around Provo, UT
        </span>
        <h1
          className="text-foreground max-w-2xl text-4xl font-semibold text-balance sm:text-5xl"
          style={{ textWrap: "balance" }}
        >
          Rent a Starlink kit, dropped off and picked up.
        </h1>
        <p className="text-muted-foreground mt-4 max-w-md text-balance">
          Enter your address, pick your dates, and get an instant quote. No
          account required.
        </p>
        <div className="mt-8 flex flex-col items-center gap-2">
          <Button
            render={<Link href="/quote" />}
            nativeButton={false}
            size="lg"
          >
            Get a quote
          </Button>
          <p className="text-muted-foreground font-mono text-xs">
            Reservations open in a future phase of the build.
          </p>
        </div>
      </main>

      <footer className="text-muted-foreground relative z-10 px-6 py-6 text-center font-mono text-xs sm:px-10">
        Starlink Rentals is an independent rental service and is not affiliated
        with Starlink or SpaceX.
      </footer>
    </div>
  );
}
