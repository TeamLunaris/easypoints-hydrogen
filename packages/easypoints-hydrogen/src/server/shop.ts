import * as v from "valibot";

import { ShopLoyaltyValueSchema } from "../shared/loyalty-schema";

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
 * @returns The parsed {@link ShopLoyaltyValue}, or `null` when the metafield is absent, empty, not
 *   valid JSON, or fails schema validation.
 */
export function parseLoyaltyAttributes({
  shop,
}: ShopLoyaltyQueryResponse): ShopLoyaltyValue | null {
  const raw = shop.loyalty?.value;
  if (!raw || raw === "") {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  // Validate the shape rather than trusting it: a malformed metafield (e.g. missing `point_rules`)
  // would otherwise throw downstream in `productPoints` on `shopLoyalty.point_rules[tierUid]`.
  const result = v.safeParse(ShopLoyaltyValueSchema, parsed);
  if (!result.success) {
    console.error("Invalid shop loyalty metafield:", v.flatten(result.issues));
    return null;
  }

  return result.output;
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
