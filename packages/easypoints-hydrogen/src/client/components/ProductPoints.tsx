"use client";

import type { ReactNode } from "react";

/** Values handed to {@link ProductPoints}'s render prop. Points are guaranteed present here. */
export interface ProductPointsRenderProps {
  /** `points` rendered with `toLocaleString()`. */
  formattedPoints: string;
}

/** Props for {@link ProductPoints}. */
export interface ProductPointsProps {
  /** Points earned for the product, or `null` / `undefined` when not yet known. */
  points?: number | null;
  /**
   * Rendered when there are no points (`null` / `undefined`). Defaults to `null` (render nothing).
   * Receiving the empty case here is what lets `children` assume points are present.
   */
  fallback?: ReactNode;
  /** Render prop receiving {@link ProductPointsRenderProps}, only invoked when points are present. */
  children: (props: ProductPointsRenderProps) => ReactNode;
}

/**
 * Headless wrapper exposing a product's earnable points.
 *
 * Renders no markup of its own — when `points` is present it derives `{ formattedPoints }` and hands
 * it to `children`; when `points` is `null` / `undefined` it renders `fallback` (or nothing).
 */
export function ProductPoints({
  points,
  fallback = null,
  children,
}: ProductPointsProps): ReactNode {
  if (points === null || points === undefined) return fallback;

  return children({ formattedPoints: points.toLocaleString() });
}
