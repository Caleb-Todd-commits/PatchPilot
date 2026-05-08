export type InventoryItem = {
  sku: string;
  inStock: number;
};

export function canFulfill(items: InventoryItem[], sku: string, quantity: number): boolean {
  const item = items.find((candidate) => candidate.sku === sku);
  return Boolean(item && item.inStock >= quantity);
}
