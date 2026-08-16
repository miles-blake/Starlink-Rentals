import { describe, expect, it } from "vitest";
import {
  IllegalTransitionError,
  assertLegalTransition,
  isLegalTransition,
  legalNextStatuses,
} from "./reservation-state-machine";

describe("reservation state machine", () => {
  it("allows each Phase 4 admin action", () => {
    expect(isLegalTransition("payment_review", "confirmed", "admin")).toBe(
      true
    );
    expect(isLegalTransition("confirmed", "scheduled", "admin")).toBe(true);
    expect(isLegalTransition("scheduled", "active", "admin")).toBe(true);
    expect(isLegalTransition("active", "returned", "admin")).toBe(true);
    expect(isLegalTransition("returned", "completed", "admin")).toBe(true);
  });

  it("allows admin cancellation from every cancellable status", () => {
    for (const from of [
      "awaiting_payment",
      "payment_review",
      "confirmed",
      "scheduled",
    ] as const) {
      expect(isLegalTransition(from, "cancelled", "admin")).toBe(true);
    }
  });

  it("rejects cancellation once the unit has been handed over", () => {
    for (const from of ["active", "returned", "completed"] as const) {
      expect(isLegalTransition(from, "cancelled", "admin")).toBe(false);
    }
  });

  it("rejects skipping a step", () => {
    expect(isLegalTransition("confirmed", "active", "admin")).toBe(false);
    expect(isLegalTransition("payment_review", "scheduled", "admin")).toBe(
      false
    );
    expect(isLegalTransition("awaiting_payment", "confirmed", "admin")).toBe(
      false
    );
  });

  it("rejects moving backward", () => {
    expect(isLegalTransition("confirmed", "payment_review", "admin")).toBe(
      false
    );
    expect(isLegalTransition("returned", "active", "admin")).toBe(false);
  });

  it("rejects a transition attempted by the wrong actor", () => {
    // Only the customer's own "I have paid" action can do this, not admin.
    expect(
      isLegalTransition("awaiting_payment", "payment_review", "admin")
    ).toBe(false);
    expect(
      isLegalTransition("awaiting_payment", "payment_review", "customer")
    ).toBe(true);
  });

  it("assertLegalTransition throws IllegalTransitionError on an illegal move", () => {
    expect(() => assertLegalTransition("confirmed", "active", "admin")).toThrow(
      IllegalTransitionError
    );
  });

  it("assertLegalTransition does not throw on a legal move", () => {
    expect(() =>
      assertLegalTransition("confirmed", "scheduled", "admin")
    ).not.toThrow();
  });

  it("legalNextStatuses lists every admin option from a given status", () => {
    expect(legalNextStatuses("confirmed", "admin").sort()).toEqual(
      ["cancelled", "scheduled"].sort()
    );
    expect(legalNextStatuses("returned", "admin")).toEqual(["completed"]);
    expect(legalNextStatuses("completed", "admin")).toEqual([]);
  });
});
