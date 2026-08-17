import Link from "next/link";

export function LegalFooter() {
  return (
    <footer className="text-muted-foreground relative z-10 flex flex-col items-center gap-2 px-6 py-6 text-center font-mono text-xs sm:px-10">
      <p>
        Starlink Rentals is an independent rental service and is not
        affiliated with, endorsed by, or sponsored by Starlink or SpaceX.
      </p>
      <nav className="flex items-center gap-4">
        <Link href="/terms" className="hover:text-foreground underline">
          Terms &amp; cancellation policy
        </Link>
        <Link href="/privacy" className="hover:text-foreground underline">
          Privacy
        </Link>
      </nav>
    </footer>
  );
}
