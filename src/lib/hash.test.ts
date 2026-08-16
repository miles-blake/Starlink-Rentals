import { describe, expect, it } from "vitest";
import { sha256Hex } from "./hash";

describe("sha256Hex", () => {
  it("matches a known SHA-256 vector", () => {
    // echo -n "abc" | sha256sum
    const expected =
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
    expect(sha256Hex("abc")).toBe(expected);
  });

  it("is deterministic for the same input", () => {
    const text = "Starlink Rentals — Rental Agreement";
    expect(sha256Hex(text)).toBe(sha256Hex(text));
  });

  it("changes when the input changes by even one character", () => {
    expect(sha256Hex("Agreement version 1")).not.toBe(
      sha256Hex("Agreement version 2")
    );
  });
});
