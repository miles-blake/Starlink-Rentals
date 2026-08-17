// Minimal single-event .ics generator — just enough for an "add the return
// time to your calendar" attachment. No recurrence, no timezone database,
// times are emitted as UTC ("Z" suffix) which every calendar app converts
// to the viewer's local time correctly.

function toIcsUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function escapeIcsText(text: string): string {
  return text.replace(/[\\;,]/g, (char) => `\\${char}`).replace(/\n/g, "\\n");
}

export function buildIcsEvent(params: {
  uid: string;
  title: string;
  description: string;
  start: Date;
  end: Date;
}): string {
  const now = toIcsUtc(new Date());
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Starlink Rentals//Reservation//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${params.uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${toIcsUtc(params.start)}`,
    `DTEND:${toIcsUtc(params.end)}`,
    `SUMMARY:${escapeIcsText(params.title)}`,
    `DESCRIPTION:${escapeIcsText(params.description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
