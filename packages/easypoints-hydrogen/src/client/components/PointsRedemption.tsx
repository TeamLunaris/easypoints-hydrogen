"use client";

// Headless points-redemption component (ported from app/components/points/RedemptionForm.tsx).
//
// The dialog, inputs, `fetcher.Form`, `Money`, i18n and Tailwind are all stripped — the state
// machine now lives in D5's `usePointsRedemption`. This component runs the hook and hands its full
// api to the consumer's render prop, which owns the form markup and submit wiring.

import { usePointsRedemption } from "../hooks/usePointsRedemption";

import type { UsePointsRedemptionParams } from "../hooks/usePointsRedemption";
import type { ReactNode } from "react";

/** Values handed to {@link PointsRedemption}'s render prop — the full {@link usePointsRedemption} api. */
export type PointsRedemptionRenderProps = ReturnType<typeof usePointsRedemption>;

/** Props for {@link PointsRedemption}: the hook params plus the render prop. */
export interface PointsRedemptionProps extends UsePointsRedemptionParams {
  /**
   * Render prop receiving the full redemption api, grouped as `{ input: { value, setValue,
   * increment, decrement, setMax, step }, form: { submit, undo, isValid, isSubmitting },
   * result: { redeemedPoints, error } }`.
   */
  children: (props: PointsRedemptionRenderProps) => ReactNode;
}

/**
 * Headless wrapper over {@link usePointsRedemption}.
 *
 * Renders no markup — it drives the redeem input + validation + adaptive stepper + REDEEM/UNDO
 * submit and hands the whole api to `children` to render (input, +/- buttons, redeem/undo button,
 * error, …).
 */
export function PointsRedemption({ children, ...params }: PointsRedemptionProps): ReactNode {
  return children(usePointsRedemption(params));
}
