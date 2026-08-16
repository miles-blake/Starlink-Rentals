export default function AdminDashboardPage() {
  return (
    <div className="flex flex-1 flex-col items-start justify-center">
      <span className="text-muted-foreground mb-2 font-mono text-xs tracking-wide uppercase">
        Dashboard
      </span>
      <h1 className="text-foreground text-2xl font-semibold">
        Nothing to show yet
      </h1>
      <p className="text-muted-foreground mt-1 max-w-md text-sm">
        Reservations, calendar, and stats land in later phases of the build.
      </p>
    </div>
  );
}
