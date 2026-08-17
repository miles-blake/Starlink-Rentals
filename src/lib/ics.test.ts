import { describe, expect, it } from "vitest";
import { buildIcsEvent } from "./ics";

describe("buildIcsEvent", () => {
  it("produces a valid single-event ICS with UTC timestamps", () => {
    const ics = buildIcsEvent({
      uid: "SL-ABCD@starlinkrentals",
      title: "Starlink return — SL-ABCD",
      description: "Return the Starlink kit.",
      start: new Date("2026-09-20T15:00:00.000Z"),
      end: new Date("2026-09-20T16:00:00.000Z"),
    });

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("UID:SL-ABCD@starlinkrentals");
    expect(ics).toContain("DTSTART:20260920T150000Z");
    expect(ics).toContain("DTEND:20260920T160000Z");
    expect(ics).toContain("SUMMARY:Starlink return — SL-ABCD");
  });

  it("escapes commas, semicolons, and newlines in text fields", () => {
    const ics = buildIcsEvent({
      uid: "u1",
      title: "Return; kit, please",
      description: "Line one\nLine two",
      start: new Date("2026-09-20T15:00:00.000Z"),
      end: new Date("2026-09-20T16:00:00.000Z"),
    });

    expect(ics).toContain("SUMMARY:Return\\; kit\\, please");
    expect(ics).toContain("DESCRIPTION:Line one\\nLine two");
  });
});
