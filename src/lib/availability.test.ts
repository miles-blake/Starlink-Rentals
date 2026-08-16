import { describe, expect, it } from "vitest";
import { findConflicts, isAvailable, rangesOverlap } from "./availability";

function range(start: string, end: string) {
  return { startDate: new Date(start), endDate: new Date(end) };
}

describe("rangesOverlap", () => {
  it("does not overlap when adjacent (one ends exactly where the other starts)", () => {
    const a = range("2026-09-01", "2026-09-05");
    const b = range("2026-09-05", "2026-09-10");
    expect(rangesOverlap(a, b)).toBe(false);
    expect(rangesOverlap(b, a)).toBe(false);
  });

  it("overlaps on a single shared day", () => {
    const a = range("2026-09-01", "2026-09-05");
    const b = range("2026-09-04", "2026-09-10");
    expect(rangesOverlap(a, b)).toBe(true);
  });

  it("overlaps when one range fully contains the other", () => {
    const a = range("2026-09-01", "2026-09-10");
    const b = range("2026-09-03", "2026-09-05");
    expect(rangesOverlap(a, b)).toBe(true);
    expect(rangesOverlap(b, a)).toBe(true);
  });

  it("overlaps when ranges are identical", () => {
    const a = range("2026-09-01", "2026-09-05");
    const b = range("2026-09-01", "2026-09-05");
    expect(rangesOverlap(a, b)).toBe(true);
  });

  it("does not overlap when completely separate", () => {
    const a = range("2026-09-01", "2026-09-05");
    const b = range("2026-10-01", "2026-10-05");
    expect(rangesOverlap(a, b)).toBe(false);
  });

  it("treats a same-day (zero-length) point as overlapping a range it falls inside", () => {
    // A same-day request (start === end) is a zero-length point in time.
    // It still conflicts if that point falls inside an existing occupied
    // range — the 1-day minimum rental rejects zero-length requests before
    // they ever reach this check, but the overlap math itself should stay
    // correct regardless.
    const zeroLength = range("2026-09-05", "2026-09-05");
    const existing = range("2026-09-01", "2026-09-10");
    expect(rangesOverlap(zeroLength, existing)).toBe(true);
  });

  it("does not overlap when the zero-length point falls outside the range", () => {
    const zeroLength = range("2026-09-15", "2026-09-15");
    const existing = range("2026-09-01", "2026-09-10");
    expect(rangesOverlap(zeroLength, existing)).toBe(false);
  });
});

describe("findConflicts", () => {
  it("returns only the ranges that actually overlap", () => {
    const requested = range("2026-09-05", "2026-09-08");
    const blocking = [
      range("2026-09-01", "2026-09-05"), // adjacent before, no conflict
      range("2026-09-06", "2026-09-07"), // inside, conflict
      range("2026-09-08", "2026-09-12"), // adjacent after, no conflict
      range("2026-09-07", "2026-09-20"), // overlaps end, conflict
    ];
    const conflicts = findConflicts(requested, blocking);
    expect(conflicts).toHaveLength(2);
  });
});

describe("isAvailable", () => {
  it("is available when there are no blocking ranges", () => {
    expect(isAvailable(range("2026-09-01", "2026-09-05"), [])).toBe(true);
  });

  it("is available when only adjacent ranges exist", () => {
    const requested = range("2026-09-05", "2026-09-10");
    expect(
      isAvailable(requested, [
        range("2026-09-01", "2026-09-05"),
        range("2026-09-10", "2026-09-15"),
      ])
    ).toBe(true);
  });

  it("is unavailable when any range overlaps", () => {
    const requested = range("2026-09-05", "2026-09-10");
    expect(
      isAvailable(requested, [
        range("2026-09-01", "2026-09-06"),
        range("2026-09-10", "2026-09-15"),
      ])
    ).toBe(false);
  });
});
