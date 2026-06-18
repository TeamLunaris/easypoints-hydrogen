"use client";

// Cart-points hook (ported from app/hooks/useCartPoints.ts).
//
// Maintains a line-id → points map for the current cart and refetches it from the cart-points
// resource route whenever the cart settles (leaves its optimistic state) or the balance changes.
//
// Browser-safe: the response type and route/action constants are coupled to D4 by *type only* —
// the `typeof import(...)` queries below are erased by the bundler, so no server code reaches the
// browser bundle.

import { useEffect, useState } from "react";
import { useFetcher } from "react-router";

import { useEasyPointsConfig } from "../context";

import type { CustomerLoyaltyMetafield } from "../../types";
import type { CalculatePointsResponse } from "../../server/routes/cartPoints";

/** Type handle to D4's cart-points route module — used only in type position (erased at build). */
type CartPointsModule = typeof import("../../server/routes/cartPoints");

/** Default route path, pinned to D4's `CART_POINTS_ROUTE_PATH` const type. */
const CART_POINTS_ROUTE_PATH: CartPointsModule["CART_POINTS_ROUTE_PATH"] = "/api/cart/points";

/** `CALCULATE_POINTS` action value, pinned to D4's `ACTIONS` const type. */
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
  /** Override the cart-points route path (else provider, else D4 default). */
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
  const config = useEasyPointsConfig();
  const route = options.route ?? config.route ?? CART_POINTS_ROUTE_PATH;
  const lineFilter = options.lineFilter ?? (() => true);

  const [pointsMap, setPointsMap] = useState<Record<string, number | null>>({});
  const fetcher = useFetcher<CalculatePointsResponse>();

  const isOptimistic = cart?.isOptimistic ?? false;
  const balance = accountPoints?.balance ?? 0;

  useEffect(() => {
    if (!cart || isOptimistic) return;

    void fetcher.submit(
      { action: CALCULATE_POINTS, pointsBalance: balance },
      { method: "post", action: route },
    );
    // `fetcher` is intentionally excluded — including it can loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOptimistic, balance, route]);

  useEffect(() => {
    setPointsMap(fetcher.data?.pointsMap ?? {});
  }, [fetcher.data]);

  const eligibleCount = (cart?.lines?.nodes ?? []).filter(lineFilter).length;

  useEffect(() => {
    if (eligibleCount === 0) setPointsMap({});
  }, [eligibleCount]);

  const totalPoints = Object.values(pointsMap).reduce(
    (sum: number, val) => (typeof val === "number" ? sum + val : sum),
    0,
  );

  return { pointsMap, totalPoints };
}
