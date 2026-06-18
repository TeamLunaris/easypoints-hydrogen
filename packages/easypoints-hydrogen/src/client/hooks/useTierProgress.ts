"use client";

// Tier-progress hook (extracted from the CustomerLoyaltySection progress calc).
//
// Wraps D2's `getCurrentTier` / `getProgressTier` and computes the progress-bar percentage with the
// same `BASE_TIER_PROGRESS_PERCENTAGE` (2%) floor and 100% cap the source used. Pure derivation —
// no markup, no animation timer (the component owns presentation).

import { getCurrentTier, getProgressTier } from "../../shared/tiers";
import { useEasyPointsConfig } from "../context";

import type { LoyaltyCustomer } from "../../types";

/** Minimum progress shown even at zero spend (matches the source's 2% floor). */
export const BASE_TIER_PROGRESS_PERCENTAGE = 2;

/**
 * Computes the customer's current tier and progress toward the next one.
 *
 * @param customer - The loyalty-bearing customer (`{ loyalty }`). Falls back to the provider's
 *   `customerLoyalty`. Pass `null` to force an empty result.
 * @param subtotal - Pending spend (e.g. a cart subtotal) in the same minor-unit (raw) amount the
 *   tier data uses, applied before evaluation. Defaults to `0`.
 * @returns
 * - `currentTier` — the customer's active {@link import("../../types").Tier}, or `null`.
 * - `progress` — the {@link getProgressTier} result for the surfaced tier, or `null`.
 * - `percentage` — progress-bar fill in `[BASE_TIER_PROGRESS_PERCENTAGE, 100]`.
 * - `dataType` — which progression state applies (`MAINTENANCE_TIER` / `NEXT_TIER` /
 *   `HIGHEST_TIER_NEXT_CYCLE`), or `null`.
 */
export function useTierProgress(customer?: LoyaltyCustomer | null, subtotal = 0) {
  const config = useEasyPointsConfig();

  const resolved: LoyaltyCustomer | null =
    customer !== undefined
      ? customer
      : config.customerLoyalty !== undefined
        ? { loyalty: config.customerLoyalty }
        : null;

  if (!resolved || resolved.loyalty === null) {
    return {
      currentTier: null,
      progress: null,
      percentage: BASE_TIER_PROGRESS_PERCENTAGE,
      dataType: null,
    };
  }

  const currentTier = getCurrentTier(resolved);
  const progress = getProgressTier(resolved, subtotal);

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
