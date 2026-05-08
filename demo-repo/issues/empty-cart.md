# Bug: empty cart total crashes

When the cart has no items, calculateTotal([]) should return 0.
Instead the cart total logic throws an error because reduce has no initial value.

Expected:
calculateTotal([]) returns 0.

Actual:
An empty cart crashes total calculation.
