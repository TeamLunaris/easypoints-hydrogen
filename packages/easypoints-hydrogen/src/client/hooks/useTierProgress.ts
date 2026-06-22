"use client";

import { getCurrentTier, getProgressTier } from "../../shared/tiers";
import { useCustomerLoyalty } from "./useCustomerLoyalty";

import type { CustomerLoyaltyMetafield, LoyaltyCustomer } from "../../types";

/** Minimum progress shown even at zero spend (matches the source's 2% floor). */
export const BASE_TIER_PROGRESS_PERCENTAGE = 2;

/**
 * Computes the customer's current tier and progress toward the next one.
 *
 * @param loyalty - The customer's loyalty metafield, or `undefined` to read from the provider.
 *   Pass `null` to force an empty result. See {@link useCustomerLoyalty}.
 * @param subtotal - Pending spend (e.g. a cart subtotal) in the same minor-unit (raw) amount the
 *   tier data uses, applied before evaluation. Defaults to `0`.
 * @returns
 * - `currentTier` — the customer's active {@link import("../../types").Tier}, or `null`.
 * - `progress` — the {@link getProgressTier} result for the surfaced tier, or `null`.
 * - `percentage` — progress-bar fill in `[BASE_TIER_PROGRESS_PERCENTAGE, 100]`.
 * - `dataType` — which progression state applies (`MAINTENANCE_TIER` / `NEXT_TIER` /
 *   `HIGHEST_TIER_NEXT_CYCLE`), or `null`.
 */
export function useTierProgress(loyalty?: CustomerLoyaltyMetafield | null, subtotal = 0) {
  const resolved = useCustomerLoyalty(loyalty);

  if (resolved === null) {
    return {
      currentTier: null,
      progress: null,
      percentage: BASE_TIER_PROGRESS_PERCENTAGE,
      dataType: null,
    };
  }

  // The tier functions key off the `{ loyalty }` wrapper; build it once here.
  const customer: LoyaltyCustomer = { loyalty: resolved };
  const currentTier = getCurrentTier(customer);
  const progress = getProgressTier(customer, subtotal);

  let percentage = BASE_TIER_PROGRESS_PERCENTAGE;
  const requirement = progress?.requirement.raw ?? null;
  if (requirement !== null && requirement > 0) {
    percentage = Math.max((subtotal * 100) / requirement, BASE_TIER_PROGRESS_PERCENTAGE);
    if (percentage > 100) percentage = 100;
  }

  return {
    currentTier,
    progress,
    percentage,
    dataType: progress?.dataType ?? null,
  };
}
