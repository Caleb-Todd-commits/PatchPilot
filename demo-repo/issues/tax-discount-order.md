# Bug: tax and discount are applied in the wrong order

Cart totals are calculated in the wrong order when both tax and discount are present.

Expected business rule:
1. Calculate subtotal from items.
2. Apply discount to subtotal.
3. Clamp discounted subtotal at 0.
4. Apply tax to discounted subtotal.
5. Round final total to 2 decimals.

Example:
items = [{ price: 19.99, quantity: 2 }]
discount = 5.00
taxRate = 0.0825

subtotal = 39.98
discountedSubtotal = 34.98
tax = 2.89
final total = 37.87

Actual:
The current implementation applies tax before discount or does not round correctly, causing the final total to be wrong.
