"use client";

// Headless product-points component (ported from app/components/points/ProductPoints.tsx).
//
// Strips the `@lingui` / Lucide / Tailwind / Skeleton presentation the source carried and exposes
// the two values it derived as a render prop: the locale-formatted point count and a `show` flag
// (the source returned `null` for missing points). The consumer renders and styles everything.

import type { ReactNode } from "react";

/** Values handed to {@link ProductPoints}'s render prop. */
export interface ProductPointsRenderProps {
  /** `points` rendered with `toLocaleString()`; empty string when there are no points. */
  formattedPoints: string;
  /** Whether points are available to show (`false` for `null` / `undefined`, mirroring the source). */
  show: boolean;
}

/** Props for {@link ProductPoints}. */
export interface ProductPointsProps {
  /** Points earned for the product, or `null` / `undefined` when not yet known. */
  points?: number | null;
  /** Render prop receiving {@link ProductPointsRenderProps}. */
  children: (props: ProductPointsRenderProps) => ReactNode;
}

/**
 * Headless wrapper exposing a product's earnable points.
 *
 * Renders no markup of its own — it derives `{ formattedPoints, show }` and hands them to
 * `children`. When `points` is `null`/`undefined`, `show` is `false` (the source rendered nothing).
 */
export function ProductPoints({ points, children }: ProductPointsProps): ReactNode {
  const show = points !== null && points !== undefined;
  const formattedPoints = show ? points.toLocaleString() : "";

  return children({ formattedPoints, show });
}
