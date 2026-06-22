"use client";

import { useCallback, useEffect, useState } from "react";
import { useFetcher } from "react-router";

import { useEasyPointsConfig } from "../context";
import { useCustomerLoyalty } from "./useCustomerLoyalty";

import type { PointsActionError, RedeemPointsResponse } from "../../server/routes/cartPoints";

/** Type handle to the cart-points route module — used only in type position (erased at build). */
type CartPointsModule = typeof import("../../server/routes/cartPoints");

/** Default route path, pinned to the route's `CART_POINTS_ROUTE_PATH` const type. */
const CART_POINTS_ROUTE_PATH: CartPointsModule["CART_POINTS_ROUTE_PATH"] = "/api/cart/points";

/** `REDEEM_POINTS` action value, pinned to the route's `ACTIONS` const type. */
const REDEEM_POINTS: CartPointsModule["ACTIONS"]["REDEEM_POINTS"] = "RedeemPoints";

/** `UNDO_REDEEM` action value, pinned to the route's `ACTIONS` const type. */
const UNDO_REDEEM: CartPointsModule["ACTIONS"]["UNDO_REDEEM"] = "UndoRedeem";

/** Shared fetcher key, so the redemption fetcher can be observed across components. */
export const FETCHER_REDEMPTION_KEY = "redemption";

/** Params for {@link usePointsRedemption}. All fall back to the provider when omitted. */
export interface UsePointsRedemptionParams {
  /** Redeemable balance. Falls back to the provider's `customerLoyalty.balance`. */
  pointsBalance?: number | null;
  /** Customer GID submitted with the redeem action. Falls back to the provider's `customerId`. */
  customerId?: string | null;
  /** Override the cart-points route path (else provider, else the route default). */
  route?: string;
  /**
   * Cart line-item quantity. When provided, a change auto-undoes any active redemption — matching
   * the source's "undo on page refresh / cart change" behavior. Omit to disable.
   */
  cartTotalQuantity?: number;
  /** Disable submitting while the optimistic cart settles. */
  isOptimistic?: boolean;
}

/** Adaptive stepper increment for a balance — bigger balances step in coarser amounts. */
const getStepValue = (balance: number) => {
  if (balance >= 5000) return 500;
  if (balance >= 1000) return 100;
  if (balance >= 100) return 10;
  return 1;
};

/**
 * The redeem numeric field: parse + clamp on every write, plus the adaptive stepper.
 *
 * Returns the public `field` (the hook's `input` group), the normalized integer `amount` the
 * submit uses, and a `reset` to clear the field on undo.
 */
function useRedeemInput(balance: number) {
  const [value, setField] = useState("");

  const step = getStepValue(balance);
  const parsed = Number.parseInt(value, 10);
  const amount = Number.isNaN(parsed) ? 0 : parsed;

  // Clamp a numeric value to [0, balance] and store it as the input string (empty when <= 0) —
  // the source's `updatePointsValue`, the single point where the field is normalized.
  const setClamped = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(next, 0), balance);
      setField(clamped > 0 ? `${clamped}` : "");
    },
    [balance],
  );

  // Field setter for the input's onChange: empty stays empty, otherwise parse + clamp.
  const setValue = useCallback(
    (raw: string) => {
      if (!raw) {
        setField("");
        return;
      }

      setClamped(Number.parseInt(raw, 10));
    },
    [setClamped],
  );

  const increment = useCallback(() => setClamped(amount + step), [setClamped, amount, step]);
  const decrement = useCallback(() => setClamped(amount - step), [setClamped, amount, step]);
  const setMax = useCallback(() => setClamped(balance), [setClamped, balance]);
  const reset = useCallback(() => setField(""), []);

  return {
    amount,
    reset,
    field: { value, setValue, increment, decrement, setMax, step },
  };
}

/**
 * Drives the points-redemption flow: input + validation + adaptive stepper + REDEEM/UNDO submit.
 *
 * @param params - See {@link UsePointsRedemptionParams}.
 * @returns Three groups:
 * - `input` — the numeric field. `value` is the current string; `setValue(raw)` parses and clamps
 *   it to `[0, balance]` (empty stays empty); `increment` / `decrement` step by `step` (the adaptive
 *   1 / 10 / 100 / 500 increment for the balance), also clamped; `setMax` fills the full balance.
 * - `form` — the action surface: `submit` / `undo` fire the REDEEM / UNDO actions, `isValid`
 *   gates submit (a positive amount, and not mid-optimistic-update), `isSubmitting` is true while a
 *   submit is in flight.
 * - `result` — the outcome: `redeemedPoints` (points locked in after a successful redeem, else
 *   `null`) and `error` (the structured `{ code?, message }` from a failed redeem, else `null`).
 */
export function usePointsRedemption(params: UsePointsRedemptionParams = {}) {
  const config = useEasyPointsConfig();
  const loyalty = useCustomerLoyalty();
  const pointsBalance = params.pointsBalance ?? loyalty?.balance ?? null;
  const customerId = params.customerId ?? config.customerId ?? null;
  const route = params.route ?? config.route ?? CART_POINTS_ROUTE_PATH;
  const { cartTotalQuantity, isOptimistic = false } = params;

  const fetcher = useFetcher<RedeemPointsResponse | null>({ key: FETCHER_REDEMPTION_KEY });

  const { field, amount, reset } = useRedeemInput(pointsBalance ?? 0);
  const [redeemedPoints, setRedeemedPoints] = useState<number | null>(null);
  const [error, setError] = useState<PointsActionError | null>(null);

  const isSubmitting = fetcher.state === "submitting";
  const isValid = !isOptimistic && amount > 0;

  const submit = useCallback(() => {
    if (isOptimistic) return;

    void fetcher.submit(
      { action: REDEEM_POINTS, points: amount, customerId: customerId ?? "" },
      { method: "POST", action: route },
    );
    // `fetcher` is intentionally excluded — including it can loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, customerId, route, isOptimistic]);

  const undo = useCallback(() => {
    setRedeemedPoints(null);
    reset();
    setError(null);

    void fetcher.submit({ action: UNDO_REDEEM }, { method: "POST", action: route });
    // `fetcher` is intentionally excluded — including it can loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, reset]);

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
    input: field,
    form: { submit, undo, isValid, isSubmitting },
    result: { redeemedPoints, error },
  };
}
