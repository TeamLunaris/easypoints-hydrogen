"use client";

import { createContext, useContext } from "react";

import type { CustomerLoyaltyMetafield } from "../types";
import type { ReactNode } from "react";

/**
 * The shared value an {@link EasyPointsProvider} supplies to descendant hooks/components.
 *
 * Not all of it is configuration: `route` and `currencyCode` are static storefront config, while
 * `customerLoyalty` is per-request data about the current customer. Every field is optional.
 */
export interface EasyPointsContext {
  /**
   * Path the cart-points resource route is mounted at.
   * Defaults to `CART_POINTS_ROUTE_PATH` (`/api/cart/points`) when omitted.
   */
  route?: string;
  /** Currency code used by components when formatting monetary values (e.g. `"USD"`). */
  currencyCode?: string;
  /** The current customer's loyalty metafield, if the storefront resolved it server-side. */
  customerLoyalty?: CustomerLoyaltyMetafield | null;
}

const Context = createContext<EasyPointsContext | null>(null);

/** Props for {@link EasyPointsProvider}: the context fields plus `children`. */
export interface EasyPointsProviderProps extends EasyPointsContext {
  children: ReactNode;
}

/**
 * Provides the shared {@link EasyPointsContext} to descendant easyPoints hooks/components.
 *
 * Optional — hooks work without it as long as the equivalent values are passed explicitly.
 */
export function EasyPointsProvider({ children, ...value }: EasyPointsProviderProps) {
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/**
 * Reads the nearest {@link EasyPointsProvider} value.
 *
 * @returns The provider value, or an empty object when no provider is mounted.
 */
export function useEasyPoints(): EasyPointsContext {
  return useContext(Context) ?? {};
}
