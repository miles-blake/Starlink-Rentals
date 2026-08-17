export interface QuietHours {
  start: string; // "HH:MM", compared in UTC
  end: string; // "HH:MM", compared in UTC
}

function toMinutes(hhmm: string): number | null {
  const match = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

// Quiet hours are compared against the server's clock (UTC on Vercel) — the
// admin settings UI labels the field accordingly so times are entered in
// UTC, not local time.
export function isWithinQuietHours(
  quietHours: QuietHours | null | undefined,
  now: Date = new Date()
): boolean {
  if (!quietHours) return false;
  const start = toMinutes(quietHours.start);
  const end = toMinutes(quietHours.end);
  if (start === null || end === null || start === end) return false;

  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  if (start < end) {
    return nowMinutes >= start && nowMinutes < end;
  }
  // Wraps midnight, e.g. 22:00–08:00.
  return nowMinutes >= start || nowMinutes < end;
}
