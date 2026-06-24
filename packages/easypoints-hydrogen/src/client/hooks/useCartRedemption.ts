"use client";

import { useCallback, useState } from "react";
import { useFetcher } from "react-router";

import { useEasyPoints } from "../context";
import { MissingContextError } from "../errors";
import { useCustomerLoyalty } from "./useCustomerLoyalty";

import type { RedeemPointsResponse } from "../../server/routes/cartPoints";

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

/** Params for {@link useCartRedemption}. All fall back to the provider when omitted. */
export interface UseCartRedemptionParams {
  /** Redeemable balance. Falls back to the provider's `customerLoyalty.balance`. */
  pointsBalance?: number | null;
  /** Customer GID submitted with the redeem action. Falls back to the provider's `customerId`. */
  customerId?: string | null;
  /** Override the cart-points route path (else provider, else the route default). */
  route?: string;
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
 * Drives the active cart's points-redemption flow: input + validation + adaptive stepper +
 * REDEEM/UNDO submit. Bound to the current cart (submits to the cart-points route, gated on the
 * optimistic cart) — not a general-purpose coupon creator.
 *
 * @param params - See {@link UseCartRedemptionParams}.
 * @returns The resolved `pointsBalance` (explicit param, else provider loyalty, else `null` when no
 * redemption context exists) plus three groups:
 * - `input` — the numeric field. `value` is the current string; `setValue(raw)` parses and clamps
 *   it to `[0, balance]` (empty stays empty); `increment` / `decrement` step by `step` (the adaptive
 *   1 / 10 / 100 / 500 increment for the balance), also clamped; `setMax` fills the full balance.
 * - `form` — the action surface: `submit` / `undo` fire the REDEEM / UNDO actions, `isValid`
 *   gates submit (a positive amount, and not mid-optimistic-update), `isSubmitting` is true while a
 *   submit is in flight.
 * - `result` — the outcome: `redeemedPoints` (points locked in after a successful redeem, else
 *   `null`) and `error` (the structured `{ code?, message }` from a failed redeem, else `null`).
 */
export function useCartRedemption(params: UseCartRedemptionParams = {}) {
  const context = useEasyPoints();
  const loyalty = useCustomerLoyalty();

  const { isOptimistic = false } = params;
  const pointsBalance = params.pointsBalance ?? loyalty?.balance ?? null;
  const customerId = params.customerId ?? context.customerId ?? null;
  const route = params.route ?? context.route ?? CART_POINTS_ROUTE_PATH;

  const fetcher = useFetcher<RedeemPointsResponse | null>({ key: FETCHER_REDEMPTION_KEY });
  const { field, amount, reset } = useRedeemInput(pointsBalance ?? 0);

  if (pointsBalance === null) {
    throw new MissingContextError("pointsBalance", "a customer loyalty metafield");
  }

  if (customerId === null) {
    throw new MissingContextError("customerId", "a customer ID");
  }

  const isSubmitting = fetcher.state === "submitting";
  const isValid = !isOptimistic && amount > 0;

  // `redeemedPoints` / `error` reflect the settled (not in-flight) fetcher result. A new submit
  // (isSubmitting) clears both until it resolves; UNDO resolves to a null body, which also clears
  // them — so neither needs its own state nor an effect to copy `fetcher.data`.
  const settled = !isSubmitting && fetcher.data && "success" in fetcher.data ? fetcher.data : null;
  const redeemedPoints = settled?.success ? settled.points : null;
  const error = settled && !settled.success ? (settled.error ?? null) : null;

  const submit = useCallback(() => {
    if (isOptimistic) return;

    void fetcher.submit(
      { action: REDEEM_POINTS, customerId, points: amount },
      { method: "POST", action: route },
    );
    // `fetcher` is intentionally excluded — including it can loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, customerId, route, isOptimistic]);

  const undo = useCallback(() => {
    reset();

    void fetcher.submit({ action: UNDO_REDEEM }, { method: "POST", action: route });
    // `fetcher` is intentionally excluded — including it can loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, reset]);

  return {
    pointsBalance,
    input: field,
    form: { submit, undo, isValid, isSubmitting },
    result: { redeemedPoints, error },
  };
}
