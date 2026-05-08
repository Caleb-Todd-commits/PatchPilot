export function calculateTax(subtotal: number, rate: number): number {
  return Number((subtotal * rate).toFixed(2));
}
