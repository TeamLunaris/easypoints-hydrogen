"use client";

import { usePointsRedemption } from "../hooks/usePointsRedemption";

import type { UsePointsRedemptionParams } from "../hooks/usePointsRedemption";
import type { ReactNode } from "react";

/** Values handed to {@link PointsRedemption}'s render prop — the full {@link usePointsRedemption} api. */
export type PointsRedemptionRenderProps = ReturnType<typeof usePointsRedemption>;

/** Props for {@link PointsRedemption}: the hook params plus the render prop. */
export interface PointsRedemptionProps extends UsePointsRedemptionParams {
  /**
   * Rendered when there is no redeemable balance (no explicit `pointsBalance` and no provider
   * loyalty). Defaults to `null` (render nothing). Receiving the empty case here is what lets
   * `children` assume there is a balance to redeem.
   */
  fallback?: ReactNode;
  /**
   * Render prop receiving the full redemption api, grouped as `{ input: { value, setValue,
   * increment, decrement, setMax, step }, form: { submit, undo, isValid, isSubmitting },
   * result: { redeemedPoints, error } }`. Only invoked when there is a redeemable balance.
   */
  children: (props: PointsRedemptionRenderProps) => ReactNode;
}

/**
 * Headless wrapper over {@link usePointsRedemption}.
 *
 * Renders no markup — when there is a redeemable balance it drives the redeem input + validation +
 * adaptive stepper + REDEEM/UNDO submit and hands the whole api to `children` (input, +/- buttons,
 * redeem/undo button, error, …); otherwise it renders `fallback`.
 */
export function PointsRedemption({
  fallback = null,
  children,
  ...params
}: PointsRedemptionProps): ReactNode {
  const redemption = usePointsRedemption(params);

  if (redemption.pointsBalance === null) return fallback;

  return children(redemption);
}
