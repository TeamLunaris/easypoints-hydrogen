"use client";

import { createContext, useContext } from "react";

import type { CustomerLoyaltyMetafield } from "../types";
import type { ReactNode } from "react";

/** Shared configuration consumed by the client hooks. Every field is optional. */
export interface EasyPointsConfig {
  /**
   * Path the cart-points resource route is mounted at.
   * Defaults to `CART_POINTS_ROUTE_PATH` (`/api/cart/points`) when omitted.
   */
  route?: string;
  /** Currency code used by components when formatting monetary values (e.g. `"USD"`). */
  currencyCode?: string;
  /** The current customer's loyalty metafield, if the storefront resolved it server-side. */
  customerLoyalty?: CustomerLoyaltyMetafield | null;
  /** The current customer's Shopify GID (`gid://shopify/Customer/…`). */
  customerId?: string | null;
}

const EasyPointsContext = createContext<EasyPointsConfig | null>(null);

/** Props for {@link EasyPointsProvider}: the config fields plus `children`. */
export interface EasyPointsProviderProps extends EasyPointsConfig {
  children: ReactNode;
}

/**
 * Provides shared {@link EasyPointsConfig} to descendant easyPoints hooks/components.
 *
 * Optional — hooks work without it as long as the equivalent values are passed explicitly.
 */
export function EasyPointsProvider({ children, ...config }: EasyPointsProviderProps) {
  return <EasyPointsContext.Provider value={config}>{children}</EasyPointsContext.Provider>;
}

/**
 * Reads the nearest {@link EasyPointsProvider} config.
 *
 * @returns The provider config, or an empty object when no provider is mounted.
 */
export function useEasyPointsConfig(): EasyPointsConfig {
  return useContext(EasyPointsContext) ?? {};
}
