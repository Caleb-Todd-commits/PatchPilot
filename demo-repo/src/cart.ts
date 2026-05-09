import { applyFlatDiscount } from "./discounts";
import { calculateTax, roundCurrency } from "./tax";

export type CartItem = { price: number; quantity: number };

export function calculateTotal(items: CartItem[]): number {
  const [first, ...rest] = items;
  return rest.reduce((sum, item) => sum + item.price * item.quantity, first!.price * first!.quantity);
}

export function calculateCheckoutTotal(items: CartItem[], discount: number, taxRate: number): number {
  const subtotal = calculateTotal(items);
  const taxedSubtotal = subtotal + calculateTax(subtotal, taxRate);
  return roundCurrency(applyFlatDiscount(taxedSubtotal, discount));
}
