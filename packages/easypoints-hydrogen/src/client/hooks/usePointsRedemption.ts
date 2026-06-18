"use client";

// Points-redemption state machine (extracted from app/components/points/RedemptionForm.tsx).
//
// Owns the redeem-input value, validation, the adaptive stepper, and the REDEEM/UNDO submit +
// redeemed/error state — with all markup and i18n stripped out. The returned `error` is the
// structured `{ code?, message }` from D4 (no `t::`-prefixed strings); callers render it.
//
// Browser-safe: D4 types/constants are referenced type-only (see `typeof import(...)` below).

import { useCallback, useEffect, useState } from "react";
import { useFetcher } from "react-router";

import { useEasyPointsConfig } from "../context";

import type { PointsActionError, RedeemPointsResponse } from "../../server/routes/cartPoints";

/** Type handle to D4's cart-points route module — used only in type position (erased at build). */
type CartPointsModule = typeof import("../../server/routes/cartPoints");

/** Default route path, pinned to D4's `CART_POINTS_ROUTE_PATH` const type. */
const CART_POINTS_ROUTE_PATH: CartPointsModule["CART_POINTS_ROUTE_PATH"] = "/api/cart/points";

/** `REDEEM_POINTS` action value, pinned to D4's `ACTIONS` const type. */
const REDEEM_POINTS: CartPointsModule["ACTIONS"]["REDEEM_POINTS"] = "RedeemPoints";

/** `UNDO_REDEEM` action value, pinned to D4's `ACTIONS` const type. */
const UNDO_REDEEM: CartPointsModule["ACTIONS"]["UNDO_REDEEM"] = "UndoRedeem";

/** Shared fetcher key, so the redemption fetcher can be observed across components. */
export const FETCHER_REDEMPTION_KEY = "redemption";

/** Params for {@link usePointsRedemption}. All fall back to the provider when omitted. */
export interface UsePointsRedemptionParams {
  /** Redeemable balance. Falls back to the provider's `customerLoyalty.balance`. */
  pointsBalance?: number | null;
  /** Customer GID submitted with the redeem action. Falls back to the provider's `customerId`. */
  customerId?: string | null;
  /** Override the cart-points route path (else provider, else D4 default). */
  route?: string;
  /**
   * Cart line-item quantity. When provided, a change auto-undoes any active redemption — matching
   * the source's "undo on page refresh / cart change" behavior. Omit to disable.
   */
  cartTotalQuantity?: number;
  /** Disable submitting while the optimistic cart settles. */
  isOptimistic?: boolean;
}

const getStepValue = (balance: number) => {
  if (balance >= 5000) return 500;
  if (balance >= 1000) return 100;
  if (balance >= 100) return 10;
  return 1;
};

/**
 * Drives the points-redemption flow: input + validation + adaptive stepper + REDEEM/UNDO submit.
 *
 * @param params - See {@link UsePointsRedemptionParams}.
 * @returns
 * - `pointsToRedeem` / `setPointsToRedeem` — the raw input string.
 * - `canRedeem` — whether the current input is a positive integer within balance.
 * - `step` — the adaptive increment (1 / 10 / 100 / 500) for the current balance.
 * - `redeem` / `undo` — submit the REDEEM / UNDO actions.
 * - `redeemedPoints` — points locked in after a successful redeem, else `null`.
 * - `error` — the structured `{ code?, message }` from a failed redeem, else `null`.
 * - `isSubmitting` — whether a submit is in flight.
 */
export function usePointsRedemption(params: UsePointsRedemptionParams = {}) {
  const config = useEasyPointsConfig();
  const pointsBalance = params.pointsBalance ?? config.customerLoyalty?.balance ?? null;
  const customerId = params.customerId ?? config.customerId ?? null;
  const route = params.route ?? config.route ?? CART_POINTS_ROUTE_PATH;
  const { cartTotalQuantity, isOptimistic = false } = params;

  const fetcher = useFetcher<RedeemPointsResponse | null>({ key: FETCHER_REDEMPTION_KEY });

  const [pointsToRedeem, setPointsToRedeem] = useState("");
  const [redeemedPoints, setRedeemedPoints] = useState<number | null>(null);
  const [error, setError] = useState<PointsActionError | null>(null);

  const safeRedeemablePoints = pointsBalance ?? 0;
  const parsed = Number.parseInt(pointsToRedeem, 10);
  const normalizedPointsToRedeem = Number.isNaN(parsed) ? 0 : parsed;
  const isIntegerInput = /^\d+$/.test(pointsToRedeem.trim());

  const canRedeem =
    !isOptimistic &&
    isIntegerInput &&
    normalizedPointsToRedeem > 0 &&
    normalizedPointsToRedeem <= safeRedeemablePoints;

  const step = getStepValue(safeRedeemablePoints);
  const isSubmitting = fetcher.state === "submitting";

  const redeem = useCallback(() => {
    if (isOptimistic) return;

    void fetcher.submit(
      { action: REDEEM_POINTS, points: normalizedPointsToRedeem, customerId: customerId ?? "" },
      { method: "POST", action: route },
    );
    // `fetcher` is intentionally excluded — including it can loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedPointsToRedeem, customerId, route, isOptimistic]);

  const undo = useCallback(() => {
    setRedeemedPoints(null);
    setPointsToRedeem("");
    setError(null);

    void fetcher.submit({ action: UNDO_REDEEM }, { method: "POST", action: route });
    // `fetcher` is intentionally excluded — including it can loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  // Reflect the redeem/undo result: lock in points on success, surface the structured error.
  useEffect(() => {
    const data = fetcher.data;
    if (!data || !("success" in data)) return;

    if (data.success) {
      setError(null);
      setRedeemedPoints(data.points);
    } else if (data.error) {
      setError(data.error);
    }
  }, [fetcher.data]);

  // Clear stale errors as soon as a new submit starts.
  useEffect(() => {
    if (isSubmitting) setError(null);
  }, [isSubmitting]);

  // Undo any active redemption when the cart changes (and on mount), mirroring the source.
  useEffect(() => {
    if (cartTotalQuantity === undefined) return;
    undo();
    // `undo` is stable per `route`; depending on `cartTotalQuantity` is the intended trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartTotalQuantity]);

  return {
    pointsToRedeem,
    setPointsToRedeem,
    canRedeem,
    step,
    redeem,
    undo,
    redeemedPoints,
    error,
    isSubmitting,
  };
}
