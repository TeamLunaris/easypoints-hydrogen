"use client";

import { useEffect } from "react";
import { useFetcher } from "react-router";

import { useEasyPoints } from "../context";

import type { CustomerLoyaltyMetafield } from "../../types";
import type { CalculatePointsResponse } from "../../server/routes/cartPoints";

/** Type handle to the cart-points route module — used only in type position (erased at build). */
type CartPointsModule = typeof import("../../server/routes/cartPoints");

/** Default route path, pinned to the route's `CART_POINTS_ROUTE_PATH` const type. */
const CART_POINTS_ROUTE_PATH: CartPointsModule["CART_POINTS_ROUTE_PATH"] = "/api/cart/points";

/** `CALCULATE_POINTS` action value, pinned to the route's `ACTIONS` const type. */
const CALCULATE_POINTS: CartPointsModule["ACTIONS"]["CALCULATE_POINTS"] = "CalculatePoints";

/** A cart line, narrowed to the fields this hook reads. Compatible with Hydrogen cart lines. */
export interface PointsCartLine {
  id: string;
  quantity?: number;
  merchandise?: { product?: { id?: string; handle?: string } };
}

/** Cart shape the hook reads: optimistic flag + line nodes. Compatible with `useOptimisticCart`. */
export interface PointsCart {
  isOptimistic?: boolean;
  lines?: { nodes?: PointsCartLine[] } | null;
}

/** Options for {@link useCartPoints}. */
export interface UseCartPointsOptions {
  /** Override the cart-points route path (else provider, else the route default). */
  route?: string;
  /**
   * Predicate selecting which cart lines participate. Defaults to including every line. Mirror the
   * server `lineFilter` (e.g. exclude shipping protection) so the client count stays in sync.
   */
  lineFilter?: (line: PointsCartLine) => boolean;
}

/**
 * Tracks loyalty points for the items in a cart.
 *
 * Maintains a `pointsMap` keyed by cart-line id and refetches it from the cart-points route
 * whenever the cart leaves its optimistic state or the balance changes. Clears the map when the
 * cart has no eligible lines.
 *
 * @param cart - The (optionally optimistic) cart.
 * @param accountPoints - The customer's loyalty metafield, or `null` when signed out.
 * @param options - See {@link UseCartPointsOptions}.
 * @returns `{ pointsMap, totalPoints }` — the per-line map and the summed total.
 */
export function useCartPoints(
  cart: PointsCart | null | undefined,
  accountPoints: CustomerLoyaltyMetafield | null,
  options: UseCartPointsOptions = {},
) {
  const context = useEasyPoints();
  const route = options.route ?? context.route ?? CART_POINTS_ROUTE_PATH;
  const lineFilter = options.lineFilter ?? (() => true);

  const fetcher = useFetcher<CalculatePointsResponse>();

  const isOptimistic = cart?.isOptimistic ?? false;
  const balance = accountPoints?.balance ?? 0;

  const eligibleLines = (cart?.lines?.nodes ?? []).filter(lineFilter);
  const linesSignature = eligibleLines.map((l) => `${l.id}:${l.quantity ?? 1}`).join(",");

  useEffect(() => {
    if (!cart || isOptimistic) return;

    void fetcher.submit(
      { action: CALCULATE_POINTS, pointsBalance: balance },
      { method: "post", action: route },
    );
  }, [isOptimistic, balance, route, linesSignature]);

  const pointsMap = eligibleLines.length === 0 ? {} : (fetcher.data?.pointsMap ?? {});

  const totalPoints = Object.values(pointsMap).reduce(
    (sum: number, val) => (typeof val === "number" ? sum + val : sum),
    0,
  );

  return { pointsMap, totalPoints };
}
