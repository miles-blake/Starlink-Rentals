/**
 * Rental cost is firstDayRate for day 1, plus dailyRate for each additional
 * day — not a flat per-day multiply. See prisma/schema.prisma (Setting,
 * Reservation) for the same shape.
 */

export class MinRentalDaysError extends Error {
  constructor(
    public readonly numberOfDays: number,
    public readonly minRentalDays: number
  ) {
    super(
      `Minimum rental length is ${minRentalDays} day${minRentalDays === 1 ? "" : "s"}, got ${numberOfDays}.`
    );
    this.name = "MinRentalDaysError";
  }
}

export function numberOfDaysBetween(startDate: Date, endDate: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const days = Math.round(
    (Date.UTC(
      endDate.getUTCFullYear(),
      endDate.getUTCMonth(),
      endDate.getUTCDate()
    ) -
      Date.UTC(
        startDate.getUTCFullYear(),
        startDate.getUTCMonth(),
        startDate.getUTCDate()
      )) /
      msPerDay
  );
  return days;
}

export function assertMinRentalDays(
  numberOfDays: number,
  minRentalDays: number
): void {
  if (numberOfDays < minRentalDays) {
    throw new MinRentalDaysError(numberOfDays, minRentalDays);
  }
}

export function computeRentalSubtotal(params: {
  firstDayRate: number;
  dailyRate: number;
  numberOfDays: number;
}): number {
  const { firstDayRate, dailyRate, numberOfDays } = params;
  if (numberOfDays < 1) {
    throw new RangeError("numberOfDays must be at least 1");
  }
  const subtotal = firstDayRate + dailyRate * (numberOfDays - 1);
  return roundToCents(subtotal);
}

export function computeDeliveryFee(params: {
  fulfillmentMethod: "delivery" | "pickup";
  deliveryFeeModel: "flat" | "per_mile";
  deliveryFeeFlat: number | null;
  deliveryFeePerMile: number | null;
  distanceMiles: number;
}): number {
  const {
    fulfillmentMethod,
    deliveryFeeModel,
    deliveryFeeFlat,
    deliveryFeePerMile,
    distanceMiles,
  } = params;

  if (fulfillmentMethod === "pickup") {
    return 0;
  }

  if (deliveryFeeModel === "flat") {
    return roundToCents(deliveryFeeFlat ?? 0);
  }

  return roundToCents((deliveryFeePerMile ?? 0) * distanceMiles);
}

export function computeBatteryFee(params: {
  batteryRented: boolean;
  batteryDailyRate: number;
  numberOfDays: number;
}): number {
  const { batteryRented, batteryDailyRate, numberOfDays } = params;
  if (!batteryRented) return 0;
  return roundToCents(batteryDailyRate * numberOfDays);
}

export interface Quote {
  firstDayRate: number;
  dailyRate: number;
  numberOfDays: number;
  rentalSubtotal: number;
  depositAmount: number;
  deliveryFee: number;
  batteryFee: number;
  totalDue: number;
}

export function computeQuote(params: {
  firstDayRate: number;
  dailyRate: number;
  numberOfDays: number;
  depositAmount: number;
  deliveryFee: number;
  batteryFee?: number;
}): Quote {
  const {
    firstDayRate,
    dailyRate,
    numberOfDays,
    depositAmount,
    deliveryFee,
    batteryFee = 0,
  } = params;
  const rentalSubtotal = computeRentalSubtotal({
    firstDayRate,
    dailyRate,
    numberOfDays,
  });
  const totalDue = roundToCents(
    rentalSubtotal + depositAmount + deliveryFee + batteryFee
  );

  return {
    firstDayRate,
    dailyRate,
    numberOfDays,
    rentalSubtotal,
    depositAmount,
    deliveryFee,
    batteryFee,
    totalDue,
  };
}

function roundToCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}
