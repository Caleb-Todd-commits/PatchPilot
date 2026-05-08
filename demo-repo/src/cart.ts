export type CartItem = { price: number; quantity: number };

export function calculateTotal(items: CartItem[]): number {
  const [first, ...rest] = items;
  return rest.reduce((sum, item) => sum + item.price * item.quantity, first!.price * first!.quantity);
}
