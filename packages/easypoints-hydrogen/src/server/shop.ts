import { SHOP_LOYALTY_QUERY } from "./graphql";

import type { ShopLoyaltyValue } from "../types";
import type { Storefront } from "@shopify/hydrogen";

/** Shape of the `ShopLoyalty` query result (no codegen, so typed explicitly). */
interface ShopLoyaltyQueryResponse {
  shop: {
    loyalty?: { value: string } | null;
  };
}

/**
 * Runs the {@link SHOP_LOYALTY_QUERY} against the Storefront API with a long cache.
 *
 * @param storefront - The Hydrogen storefront client.
 * @returns The raw query response (the metafield value is still a JSON string).
 */
export function queryLoyaltyAttributes(storefront: Storefront) {
  return storefront.query<ShopLoyaltyQueryResponse>(SHOP_LOYALTY_QUERY, {
    cache: storefront.CacheLong(),
  });
}

/**
 * Parses the shop loyalty metafield. The metafield value is always a string from GraphQL.
 *
 * @param response - The {@link queryLoyaltyAttributes} result.
 * @returns The parsed {@link ShopLoyaltyValue}, or `null` when the metafield is absent, empty, or
 *   not valid JSON.
 */
export function parseLoyaltyAttributes({
  shop,
}: ShopLoyaltyQueryResponse): ShopLoyaltyValue | null {
  const raw = shop.loyalty?.value;
  if (!raw || raw === "") {
    return null;
  }

  try {
    return JSON.parse(raw) as ShopLoyaltyValue;
  } catch {
    return null;
  }
}

/**
 * Fetches and parses the shop's loyalty attributes.
 *
 * @param storefront - The Hydrogen storefront client.
 * @returns The parsed {@link ShopLoyaltyValue}, or `null` when unavailable.
 */
export async function fetchShopLoyalty(storefront: Storefront): Promise<ShopLoyaltyValue | null> {
  const loyalty = await queryLoyaltyAttributes(storefront);

  return parseLoyaltyAttributes(loyalty);
}
