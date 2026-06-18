"use client";

// Headless customer-loyalty component (the header half of CustomerLoyaltySection).
//
// The balance markup, divider and `Suspense`/`Await` wiring are stripped — this resolves the
// customer's loyalty metafield (via D5's `useCustomerLoyalty`), derives the current tier (via D2's
// `getCurrentTier`), and hands the raw values to the consumer's render prop to format.

import { getCurrentTier } from "../../shared/tiers";
import { useCustomerLoyalty } from "../hooks/useCustomerLoyalty";

import type { CustomerLoyaltyMetafield, Tier } from "../../types";
import type { ReactNode } from "react";

/** Values handed to {@link CustomerLoyalty}'s render prop. */
export interface CustomerLoyaltyRenderProps {
  /** The resolved loyalty metafield, or `null` when none is available. */
  loyalty: CustomerLoyaltyMetafield | null;
  /** Available points balance, or `null` when signed out / no loyalty. */
  balance: number | null;
  /** The customer's current {@link Tier}, or `null`. */
  tier: Tier | null;
  /** Whether loyalty data is available to show (`false` mirrors the source's `null` return). */
  show: boolean;
}

/** Props for {@link CustomerLoyalty}. */
export interface CustomerLoyaltyProps {
  /**
   * Explicit loyalty metafield, or `undefined` to read from the provider; pass `null` to force a
   * "no loyalty" result. See {@link useCustomerLoyalty}.
   */
  loyalty?: CustomerLoyaltyMetafield | null;
  /** Render prop receiving `{ loyalty, balance, tier, show }`. */
  children: (props: CustomerLoyaltyRenderProps) => ReactNode;
}

/**
 * Headless wrapper exposing the current customer's loyalty summary.
 *
 * Renders no markup — it resolves the loyalty metafield, derives `{ balance, tier }`, and hands
 * `{ loyalty, balance, tier, show }` to `children`. When no loyalty is available `show` is `false`.
 */
export function CustomerLoyalty({ loyalty, children }: CustomerLoyaltyProps): ReactNode {
  const resolved = useCustomerLoyalty(loyalty);
  const tier = resolved ? getCurrentTier({ loyalty: resolved }) : null;

  return children({
    loyalty: resolved,
    balance: resolved?.balance ?? null,
    tier,
    show: resolved !== null,
  });
}
