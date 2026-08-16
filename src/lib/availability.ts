/**
 * Every date range here is half-open: [startDate, endDate). The unit is
 * rented out on startDate and returned on endDate, so a new rental can
 * start exactly on another one's endDate with no gap day required.
 */
export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.startDate < b.endDate && b.startDate < a.endDate;
}

export function findConflicts<T extends DateRange>(
  requested: DateRange,
  blockingRanges: T[]
): T[] {
  return blockingRanges.filter((range) => rangesOverlap(requested, range));
}

export function isAvailable(
  requested: DateRange,
  blockingRanges: DateRange[]
): boolean {
  return findConflicts(requested, blockingRanges).length === 0;
}
