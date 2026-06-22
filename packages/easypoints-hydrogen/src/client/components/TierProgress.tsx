"use client";

import { useCustomerLoyalty } from "../hooks/useCustomerLoyalty";
import { useTierProgress } from "../hooks/useTierProgress";

import type { CustomerLoyaltyMetafield } from "../../types";
import type { ReactNode } from "react";

/** Values handed to {@link TierProgress}'s render prop — the {@link useTierProgress} result. */
export type TierProgressRenderProps = ReturnType<typeof useTierProgress>;

/** Props for {@link TierProgress}. */
export interface TierProgressProps {
  /**
   * The customer's loyalty metafield, or `undefined` to read from the provider; pass `null` to
   * force an empty result. See {@link useTierProgress}.
   */
  loyalty?: CustomerLoyaltyMetafield | null;
  /** Pending spend (e.g. a cart subtotal) applied before evaluating progress. Defaults to `0`. */
  subtotal?: number;
  /**
   * Rendered when no loyalty is available. Defaults to `null` (render nothing). Receiving the empty
   * case here is what lets `children` assume loyalty was present.
   */
  fallback?: ReactNode;
  /**
   * Render prop receiving `{ currentTier, progress, percentage, dataType }`, only invoked when
   * loyalty is available.
   */
  children: (props: TierProgressRenderProps) => ReactNode;
}

/**
 * Headless wrapper over {@link useTierProgress}.
 *
 * Renders no markup. When loyalty is available it computes `{ currentTier, progress, percentage,
 * dataType }` and hands them to `children` to render and format (progress bar, tier names, "spend X
 * more" message, …); otherwise it renders `fallback`.
 */
export function TierProgress({
  loyalty,
  subtotal,
  fallback = null,
  children,
}: TierProgressProps): ReactNode {
  // Resolve loyalty up front for the presence gate; `useTierProgress` re-resolves internally (cheap
  // and idempotent) and must be called unconditionally to respect the rules of hooks.
  const resolved = useCustomerLoyalty(loyalty);
  const progress = useTierProgress(loyalty, subtotal);

  if (resolved === null) return fallback;

  return children(progress);
}
