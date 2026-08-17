import { describe, expect, it } from "vitest";
import {
  generateOtpCode,
  isAdminLocked,
  lockoutRemainingMinutes,
} from "./admin-login-security";

describe("generateOtpCode", () => {
  it("always returns a zero-padded 6-digit string", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateOtpCode();
      expect(code).toMatch(/^\d{6}$/);
    }
  });
});

describe("isAdminLocked", () => {
  it("returns false when lockedUntil is null", () => {
    expect(isAdminLocked({ lockedUntil: null })).toBe(false);
  });

  it("returns false when lockedUntil is in the past", () => {
    expect(isAdminLocked({ lockedUntil: new Date(Date.now() - 1000) })).toBe(
      false
    );
  });

  it("returns true when lockedUntil is in the future", () => {
    expect(isAdminLocked({ lockedUntil: new Date(Date.now() + 60_000) })).toBe(
      true
    );
  });
});

describe("lockoutRemainingMinutes", () => {
  it("returns 0 when not locked", () => {
    expect(lockoutRemainingMinutes({ lockedUntil: null })).toBe(0);
  });

  it("rounds up to at least 1 minute for a lockout ending soon", () => {
    expect(
      lockoutRemainingMinutes({ lockedUntil: new Date(Date.now() + 5_000) })
    ).toBe(1);
  });

  it("rounds up partial minutes", () => {
    expect(
      lockoutRemainingMinutes({
        lockedUntil: new Date(Date.now() + 90_000),
      })
    ).toBe(2);
  });
});
