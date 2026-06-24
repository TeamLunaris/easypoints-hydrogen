"use client";

import { useCartRedemption } from "../hooks/useCartRedemption";

import type { UseCartRedemptionParams } from "../hooks/useCartRedemption";
import type { ReactNode } from "react";

/** Values handed to {@link CartRedemption}'s render prop — the full {@link useCartRedemption} api. */
export type CartRedemptionRenderProps = ReturnType<typeof useCartRedemption>;

/** Props for {@link CartRedemption}: the hook params plus the render prop. */
export interface CartRedemptionProps extends UseCartRedemptionParams {
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
  children: (props: CartRedemptionRenderProps) => ReactNode;
}

/**
 * Headless wrapper over {@link useCartRedemption}.
 *
 * Renders no markup — when there is a redeemable balance it drives the redeem input + validation +
 * adaptive stepper + REDEEM/UNDO submit and hands the whole api to `children` (input, +/- buttons,
 * redeem/undo button, error, …); otherwise it renders `fallback`.
 */
export function CartRedemption({
  fallback = null,
  children,
  ...params
}: CartRedemptionProps): ReactNode {
  const redemption = useCartRedemption(params);

  if (redemption.pointsBalance === null) return fallback;

  return children(redemption);
}
