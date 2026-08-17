const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function formatCurrency(amount: number | string): string {
  return currencyFormatter.format(Number(amount));
}

// startDate/endDate are pure calendar dates stored as UTC midnight — read
// back with UTC components (not local getters) so the displayed day never
// shifts backward in a timezone behind UTC.
export function formatCalendarDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// Scheduling/event timestamps are real moments in time, not calendar dates
// — show them in the viewer's own local timezone.
// Formats a stored +1XXXXXXXXXX number for display. Falls back to the raw
// value for any shape it doesn't recognize (e.g. non-US numbers).
export function formatUsPhone(phone: string): string {
  const match = phone.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  if (!match) return phone;
  return `+1 (${match[1]}) ${match[2]}-${match[3]}`;
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
