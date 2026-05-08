import { describe, expect, it } from "vitest";
import { applyDiscount } from "../src/discounts";

describe("applyDiscount", () => {
  it("applies welcome discounts", () => {
    expect(applyDiscount(100, "WELCOME10")).toBe(90);
  });

  it("leaves totals unchanged without a discount code", () => {
    expect(applyDiscount(42)).toBe(42);
  });
});
