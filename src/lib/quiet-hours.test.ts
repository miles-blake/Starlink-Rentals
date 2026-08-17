import { describe, expect, it } from "vitest";
import { isWithinQuietHours } from "./quiet-hours";

describe("isWithinQuietHours", () => {
  it("returns false when quiet hours are not set", () => {
    expect(isWithinQuietHours(null)).toBe(false);
    expect(isWithinQuietHours(undefined)).toBe(false);
  });

  it("handles a same-day window (e.g. 09:00-17:00)", () => {
    const quietHours = { start: "09:00", end: "17:00" };
    expect(
      isWithinQuietHours(quietHours, new Date("2026-01-01T12:00:00.000Z"))
    ).toBe(true);
    expect(
      isWithinQuietHours(quietHours, new Date("2026-01-01T09:00:00.000Z"))
    ).toBe(true);
    expect(
      isWithinQuietHours(quietHours, new Date("2026-01-01T17:00:00.000Z"))
    ).toBe(false);
    expect(
      isWithinQuietHours(quietHours, new Date("2026-01-01T20:00:00.000Z"))
    ).toBe(false);
  });

  it("handles a window that wraps midnight (e.g. 22:00-08:00)", () => {
    const quietHours = { start: "22:00", end: "08:00" };
    expect(
      isWithinQuietHours(quietHours, new Date("2026-01-01T23:00:00.000Z"))
    ).toBe(true);
    expect(
      isWithinQuietHours(quietHours, new Date("2026-01-02T03:00:00.000Z"))
    ).toBe(true);
    expect(
      isWithinQuietHours(quietHours, new Date("2026-01-01T12:00:00.000Z"))
    ).toBe(false);
    expect(
      isWithinQuietHours(quietHours, new Date("2026-01-01T08:00:00.000Z"))
    ).toBe(false);
  });

  it("returns false for identical start and end (no window)", () => {
    expect(isWithinQuietHours({ start: "09:00", end: "09:00" })).toBe(false);
  });

  it("returns false for malformed times", () => {
    expect(isWithinQuietHours({ start: "bad", end: "17:00" })).toBe(false);
  });
});
