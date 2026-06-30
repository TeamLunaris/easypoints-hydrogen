"use client";

// Accessor for the current customer's loyalty metafield.
//
// Resolves the explicit argument first, falling back to whatever an {@link EasyPointsProvider}
// supplies. Trivial today, but centralizing the arg-vs-provider resolution keeps the other hooks
// and the render-prop components consistent.

import { useEasyPoints } from "../context";

import type { CustomerLoyaltyMetafield } from "../../types";

/**
 * Returns the customer's loyalty metafield from the explicit argument or the provider.
 *
 * Passing `undefined` (the default) defers to the provider; passing `null` explicitly forces a
 * "no loyalty" result regardless of the provider.
 *
 * @param loyalty - Explicit loyalty metafield, or `undefined` to read from the provider.
 * @returns The resolved loyalty metafield, or `null` when none is available.
 */
export function useCustomerLoyalty(
  loyalty?: CustomerLoyaltyMetafield | null,
): CustomerLoyaltyMetafield | null {
  const context = useEasyPoints();

  return loyalty !== undefined ? loyalty : (context.customerLoyalty ?? null);
}
