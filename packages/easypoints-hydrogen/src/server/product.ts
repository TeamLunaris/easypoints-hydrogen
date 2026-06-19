import * as v from "valibot";

import { CollectionBonusPointsSchema } from "../shared/loyalty-schema";

import { PRODUCT_LOYALTY_QUERY } from "./graphql";
import { fetchShopLoyalty } from "./shop";

import type { EasyPointsClient } from "./loyalty";
import type { CollectionBonusPoints } from "../shared/loyalty-schema";
import type { Storefront } from "@shopify/hydrogen";
import type { CountryCode, SelectedOptionInput } from "@shopify/hydrogen/storefront-api-types";

/** Arguments identifying the product/variant to score and the quantity in the cart. */
interface ProductPointsArgs {
  handle: string;
  selectedOptions: SelectedOptionInput[];
  quantity?: number;
}

/** Points earned for a product: per-unit (`singlePoints`) and for the full line (`totalPoints`). */
export interface ProductPoints {
  totalPoints: number;
  singlePoints: number;
}

/**
 * Calculates the reward points for a product from its price, the customer's tier, and any
 * applicable collection bonus.
 *
 * Rate = `percentage / 100 + maxCollectionBonusRatio`, where `percentage` is the shop's default
 * earn rate unless the customer's tier has an override in `shopLoyalty.point_rules[tierUid]`, and
 * `maxCollectionBonusRatio` is the largest `point_value / currency_value` across the product's
 * active collections. Points are `floor(priceCents * rate)` per unit, scaled by quantity.
 *
 * Resolves to `null` (rather than throwing) on every "no data" path — missing product, missing
 * price, missing shop loyalty — and logs unexpected errors to `console.error`.
 *
 * @param loyalty - The initialized {@link EasyPointsClient}.
 * @param args - The product handle, selected options, and quantity (default `1`).
 * @returns The computed {@link ProductPoints}, or `null` when unavailable.
 */
export async function productPoints(
  loyalty: EasyPointsClient,
  { handle, selectedOptions, quantity = 1 }: ProductPointsArgs,
): Promise<ProductPoints | null> {
  try {
    const { storefront } = loyalty.context();

    const [product, shopLoyalty, customerLoyalty] = await Promise.all([
      fetchProductLoyalty(storefront, { handle, selectedOptions }),
      fetchShopLoyalty(storefront),
      loyalty.getCustomerLoyalty(),
    ]);

    if (!product) return null;
    if (product.price === null) return null;
    if (!shopLoyalty) return null;

    let { percentage } = shopLoyalty;
    const price = product.price * 100;
    if (customerLoyalty && shopLoyalty.point_rules[customerLoyalty.tierUid]) {
      percentage = shopLoyalty.point_rules[customerLoyalty.tierUid].percentage;
    }

    const maxCollectionBonusRatio = product.collections.reduce((maxRatio, collection) => {
      if (collection.active) {
        const ratio = collection.point_value / collection.currency_value;
        return ratio >= maxRatio ? ratio : maxRatio;
      }

      return maxRatio;
    }, 0.0);

    const rate = percentage / 100 + maxCollectionBonusRatio;
    const rawPoints = price * rate;

    return {
      totalPoints: Math.floor(rawPoints * quantity),
      singlePoints: Math.floor(rawPoints),
    };
  } catch (error) {
    console.error(error);
    return null;
  }
}

/** Collection node as returned by the {@link PRODUCT_LOYALTY_QUERY}. */
interface CollectionNode {
  id: string;
  bonusPoints: { value: string } | null;
}

/** Shape of the `ProductLoyalty` query result (no codegen, so typed explicitly). */
interface ProductLoyaltyQueryData {
  product: {
    id: string;
    selectedOrFirstAvailableVariant: {
      price: { amount: string; currencyCode: string };
    } | null;
    collections: { nodes: CollectionNode[] };
  } | null;
}

/** Options for {@link fetchProductLoyalty}; `country`/`firstCollections` mirror the query defaults. */
interface FetchProductLoyaltyOptions {
  handle: string;
  selectedOptions: SelectedOptionInput[];
  country?: CountryCode;
  firstCollections?: number;
}

/**
 * Fetches a product's price and its collections' bonus-point metafields.
 *
 * @param storefront - The Hydrogen storefront client.
 * @param options - The product handle, selected options, and optional `country` (default `US`) /
 *   `firstCollections` (default `10`).
 * @returns `{ price, collections }` (price may be `null` when the variant has no parseable amount),
 *   or `null` when the product is not found.
 */
export async function fetchProductLoyalty(
  storefront: Storefront,
  { handle, selectedOptions, country = "US", firstCollections = 10 }: FetchProductLoyaltyOptions,
): Promise<{ price: number | null; collections: CollectionBonusPoints[] } | null> {
  const { product } = await storefront.query<ProductLoyaltyQueryData>(PRODUCT_LOYALTY_QUERY, {
    variables: { handle, selectedOptions, country, firstCollections } as unknown as Record<
      string,
      unknown
    >,
    cache: storefront.CacheLong(),
  });

  if (!product) return null;

  let price: number | null = Number(product.selectedOrFirstAvailableVariant?.price.amount);
  price = !Number.isNaN(price) ? price : null;

  const collections: CollectionBonusPoints[] = product.collections.nodes.flatMap((node) => {
    const { bonusPoints } = node;
    if (!bonusPoints) return [];

    let parsed: unknown;
    try {
      parsed = JSON.parse(bonusPoints.value);
    } catch {
      return [];
    }

    // Drop a malformed bonus metafield (same as unparseable JSON above): an invalid shape would
    // otherwise yield NaN ratios that the `>=` comparison silently swallows, skewing the points math.
    const result = v.safeParse(CollectionBonusPointsSchema, parsed);
    return result.success ? [result.output] : [];
  });

  return { price, collections };
}
