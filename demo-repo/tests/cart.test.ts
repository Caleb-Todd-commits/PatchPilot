import { describe, expect, it } from "vitest";
import { calculateTotal } from "../src/cart";

describe("calculateTotal", () => {
  it("calculates totals for normal carts", () => {
    expect(
      calculateTotal([
        { price: 12, quantity: 2 },
        { price: 5, quantity: 3 }
      ])
    ).toBe(39);
  });
});
