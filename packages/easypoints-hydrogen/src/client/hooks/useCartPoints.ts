"use client";

import { useEffect } from "react";
import { useFetcher } from "react-router";

import { useEasyPoints } from "../context";

import type { CalculatePointsResponse } from "../../server/routes/cartPoints";

/** Type handle to the cart-points route module — used only in type position (erased at build). */
type CartPointsModule = typeof import("../../server/routes/cartPoints");

/** Per-line points map, derived from the route's response so it stays the single source of truth. */
type PointsMap = NonNullable<CalculatePointsResponse>["pointsMap"];

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
 * Accepts a nullable cart so it can be wired directly to Hydrogen's loader cart or
 * `useOptimisticCart` output. When `cart` is `null`/`undefined` (not yet loaded) or has no
 * eligible lines, the hook skips the fetch and returns an empty map — it never throws.
 *
 * @param cart - The (optionally optimistic) cart, or `null`/`undefined` before it loads.
 * @param options - See {@link UseCartPointsOptions}.
 * @returns `{ pointsMap, totalPoints }` — the per-line map and the summed total
 *   (`{}` and `0` until an eligible cart resolves).
 */
export function useCartPoints(
  cart: PointsCart | null | undefined,
  options: UseCartPointsOptions = {},
) {
  const context = useEasyPoints();
  const fetcher = useFetcher<CalculatePointsResponse>();

  const route = options.route ?? context.route ?? CART_POINTS_ROUTE_PATH;
  const lineFilter = options.lineFilter ?? (() => true);

  const isOptimistic = cart?.isOptimistic ?? false;
  const eligibleLines = (cart?.lines?.nodes ?? []).filter(lineFilter);
  const linesSignature = eligibleLines.map((l) => `${l.id}:${l.quantity ?? 1}`).join(",");

  useEffect(() => {
    if (!cart || isOptimistic) return;

    void fetcher.submit({ action: CALCULATE_POINTS }, { method: "post", action: route });
  }, [isOptimistic, route, linesSignature]);

  let pointsMap: PointsMap = {};
  if (eligibleLines.length > 0) {
    pointsMap = fetcher.data?.pointsMap ?? {};
  }

  const totalPoints = Object.values(pointsMap).reduce<number>((sum, val) => sum + (val ?? 0), 0);

  return { pointsMap, totalPoints };
}
