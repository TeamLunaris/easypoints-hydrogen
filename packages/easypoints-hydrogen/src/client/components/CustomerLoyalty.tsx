"use client";

import { getCurrentTier } from "../../shared/tiers";
import { useCustomerLoyalty } from "../hooks/useCustomerLoyalty";

import type { CustomerLoyaltyMetafield, Tier } from "../../types";
import type { ReactNode } from "react";

/** Values handed to {@link CustomerLoyalty}'s render prop. Loyalty is guaranteed present here. */
export interface CustomerLoyaltyRenderProps {
  /** The resolved loyalty metafield — never `null` inside `children` (see `fallback`). */
  loyalty: CustomerLoyaltyMetafield;
  /** Available points balance. */
  balance: number;
  /** The customer's current {@link Tier}, or `null` when no tier matches. */
  tier: Tier | null;
}

/** Props for {@link CustomerLoyalty}. */
export interface CustomerLoyaltyProps {
  /**
   * Explicit loyalty metafield, or `undefined` to read from the provider; pass `null` to force a
   * "no loyalty" result. See {@link useCustomerLoyalty}.
   */
  loyalty?: CustomerLoyaltyMetafield | null;
  /**
   * Rendered when no loyalty is available. Defaults to `null` (render nothing). Receiving the empty
   * case here is what lets `children` assume loyalty is present.
   */
  fallback?: ReactNode;
  /** Render prop receiving `{ loyalty, balance, tier }`, only invoked when loyalty is available. */
  children: (props: CustomerLoyaltyRenderProps) => ReactNode;
}

/**
 * Headless wrapper exposing the current customer's loyalty summary.
 *
 * Renders no markup of its own. It resolves the loyalty metafield and, when present, derives
 * `{ balance, tier }` and hands `{ loyalty, balance, tier }` to `children`. When no loyalty is
 * available it renders `fallback` instead (or nothing if `fallback` is omitted).
 */
export function CustomerLoyalty({
  loyalty,
  fallback = null,
  children,
}: CustomerLoyaltyProps): ReactNode {
  const resolved = useCustomerLoyalty(loyalty);

  if (resolved === null) return fallback;

  return children({
    loyalty: resolved,
    balance: resolved.balance,
    tier: getCurrentTier({ loyalty: resolved }),
  });
}
