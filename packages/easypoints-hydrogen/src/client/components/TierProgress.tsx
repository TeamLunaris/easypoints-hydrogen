"use client";

// Headless tier-progress component (the progress half of CustomerLoyaltySection).
//
// All markup (progress bar, `Money`, i18n tier messages, the 500ms animation timer) is stripped —
// the calc now lives in D5's `useTierProgress`. This component just runs the hook and hands its
// result to the consumer's render prop.

import { useTierProgress } from "../hooks/useTierProgress";

import type { LoyaltyCustomer } from "../../types";
import type { ReactNode } from "react";

/** Values handed to {@link TierProgress}'s render prop — the {@link useTierProgress} result. */
export type TierProgressRenderProps = ReturnType<typeof useTierProgress>;

/** Props for {@link TierProgress}. */
export interface TierProgressProps {
  /**
   * The loyalty-bearing customer. Falls back to the provider's `customerLoyalty`; pass `null` to
   * force an empty result. See {@link useTierProgress}.
   */
  customer?: LoyaltyCustomer | null;
  /** Pending spend (e.g. a cart subtotal) applied before evaluating progress. Defaults to `0`. */
  subtotal?: number;
  /** Render prop receiving `{ currentTier, progress, percentage, dataType }`. */
  children: (props: TierProgressRenderProps) => ReactNode;
}

/**
 * Headless wrapper over {@link useTierProgress}.
 *
 * Renders no markup — it computes `{ currentTier, progress, percentage, dataType }` and hands them
 * to `children` to render and format (progress bar, tier names, "spend X more" message, …).
 */
export function TierProgress({ customer, subtotal, children }: TierProgressProps): ReactNode {
  return children(useTierProgress(customer, subtotal));
}
