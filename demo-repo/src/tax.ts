export function roundCurrency(amount: number): number {
  return Number(amount.toFixed(2));
}

export function calculateTax(subtotal: number, rate: number): number {
  return roundCurrency(subtotal * rate);
}
