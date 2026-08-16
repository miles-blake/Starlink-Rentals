import { describe, expect, it } from "vitest";
import {
  MinRentalDaysError,
  assertMinRentalDays,
  computeDeliveryFee,
  computeQuote,
  computeRentalSubtotal,
  numberOfDaysBetween,
} from "./pricing";

describe("computeRentalSubtotal", () => {
  it("charges firstDayRate for a single day", () => {
    expect(
      computeRentalSubtotal({
        firstDayRate: 30,
        dailyRate: 20,
        numberOfDays: 1,
      })
    ).toBe(30);
  });

  it("matches the user's week-long anchor: $150 for 7 days", () => {
    expect(
      computeRentalSubtotal({
        firstDayRate: 30,
        dailyRate: 20,
        numberOfDays: 7,
      })
    ).toBe(150);
  });

  it("scales linearly between the anchors", () => {
    expect(
      computeRentalSubtotal({
        firstDayRate: 30,
        dailyRate: 20,
        numberOfDays: 2,
      })
    ).toBe(50);
    expect(
      computeRentalSubtotal({
        firstDayRate: 30,
        dailyRate: 20,
        numberOfDays: 3,
      })
    ).toBe(70);
  });

  it("keeps scaling past a week", () => {
    expect(
      computeRentalSubtotal({
        firstDayRate: 30,
        dailyRate: 20,
        numberOfDays: 14,
      })
    ).toBe(290);
  });

  it("rejects zero or negative days", () => {
    expect(() =>
      computeRentalSubtotal({
        firstDayRate: 30,
        dailyRate: 20,
        numberOfDays: 0,
      })
    ).toThrow(RangeError);
  });
});

describe("computeDeliveryFee", () => {
  it("is free for pickup regardless of model", () => {
    expect(
      computeDeliveryFee({
        fulfillmentMethod: "pickup",
        deliveryFeeModel: "flat",
        deliveryFeeFlat: 15,
        deliveryFeePerMile: null,
        distanceMiles: 12,
      })
    ).toBe(0);
  });

  it("charges the flat fee for delivery under the flat model", () => {
    expect(
      computeDeliveryFee({
        fulfillmentMethod: "delivery",
        deliveryFeeModel: "flat",
        deliveryFeeFlat: 15,
        deliveryFeePerMile: null,
        distanceMiles: 12,
      })
    ).toBe(15);
  });

  it("charges distance * per-mile rate under the per_mile model", () => {
    expect(
      computeDeliveryFee({
        fulfillmentMethod: "delivery",
        deliveryFeeModel: "per_mile",
        deliveryFeeFlat: null,
        deliveryFeePerMile: 1.5,
        distanceMiles: 10,
      })
    ).toBe(15);
  });
});

describe("computeQuote", () => {
  it("sums rental, deposit, and delivery into totalDue", () => {
    const quote = computeQuote({
      firstDayRate: 30,
      dailyRate: 20,
      numberOfDays: 4,
      depositAmount: 300,
      deliveryFee: 15,
    });
    expect(quote.rentalSubtotal).toBe(90);
    expect(quote.totalDue).toBe(90 + 300 + 15);
  });
});

describe("assertMinRentalDays", () => {
  it("throws MinRentalDaysError when below the minimum", () => {
    expect(() => assertMinRentalDays(0, 1)).toThrow(MinRentalDaysError);
  });

  it("passes silently when at or above the minimum", () => {
    expect(() => assertMinRentalDays(1, 1)).not.toThrow();
  });
});

describe("numberOfDaysBetween", () => {
  it("treats a same-day start/end as 0 days (below the 1-day minimum)", () => {
    expect(
      numberOfDaysBetween(new Date("2026-09-01"), new Date("2026-09-01"))
    ).toBe(0);
  });

  it("counts a 1-day rental (start to start+1) as 1 day", () => {
    expect(
      numberOfDaysBetween(new Date("2026-09-01"), new Date("2026-09-02"))
    ).toBe(1);
  });

  it("counts a 4-day span correctly", () => {
    expect(
      numberOfDaysBetween(new Date("2026-09-01"), new Date("2026-09-05"))
    ).toBe(4);
  });
});
