export type DiscountCode = "WELCOME10" | "FREESHIP" | "NONE";

export function applyDiscount(subtotal: number, code: DiscountCode = "NONE"): number {
  if (code === "WELCOME10") {
    return Math.max(0, subtotal * 0.9);
  }

  return subtotal;
}
