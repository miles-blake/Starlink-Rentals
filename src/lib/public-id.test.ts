import { describe, expect, it, vi } from "vitest";
import {
  PublicIdExhaustedError,
  generatePublicIdCandidate,
  generateUniquePublicId,
} from "./public-id";

describe("generatePublicIdCandidate", () => {
  it("matches the SL-XXXX shape with unambiguous characters only", () => {
    for (let i = 0; i < 50; i++) {
      expect(generatePublicIdCandidate()).toMatch(
        /^SL-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/
      );
    }
  });

  it("excludes ambiguous characters (0, O, 1, I, L) from the generated code", () => {
    for (let i = 0; i < 50; i++) {
      const code = generatePublicIdCandidate().split("-")[1];
      expect(code).not.toMatch(/[01OIL]/);
    }
  });

  it("respects a custom prefix and length", () => {
    expect(generatePublicIdCandidate("RV", 6)).toMatch(
      /^RV-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/
    );
  });
});

describe("generateUniquePublicId", () => {
  it("returns the first candidate when it's not taken", async () => {
    const exists = vi.fn().mockResolvedValue(false);
    const id = await generateUniquePublicId(exists);
    expect(exists).toHaveBeenCalledTimes(1);
    expect(id).toMatch(/^SL-/);
  });

  it("retries on collision until it finds a free code", async () => {
    const exists = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    const id = await generateUniquePublicId(exists);
    expect(exists).toHaveBeenCalledTimes(3);
    expect(id).toMatch(/^SL-/);
  });

  it("throws PublicIdExhaustedError after maxAttempts collisions", async () => {
    const exists = vi.fn().mockResolvedValue(true);
    await expect(
      generateUniquePublicId(exists, { maxAttempts: 3 })
    ).rejects.toThrow(PublicIdExhaustedError);
    expect(exists).toHaveBeenCalledTimes(3);
  });
});
