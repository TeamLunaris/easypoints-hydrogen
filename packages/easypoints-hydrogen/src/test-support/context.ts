// Server-side context builders. These assemble the narrow `Storefront` / `EasyPointsClient` / `Cart`
// stand-ins the server tests need: a storefront that answers the shop + product loyalty queries from
// fixtures, a loyalty client wrapping it (with a `createCoupon` spy), a cart with an
// `updateDiscountCodes` spy, and the GraphQL customer-account context.

import { vi } from "vite-plus/test";

import { PRODUCT_LOYALTY_QUERY, SHOP_LOYALTY_QUERY } from "../server/graphql";

import type { Context, EasyPointsClient } from "../server/loyalty";
import type { CartLine } from "../server/routes/cartPoints";
import type { CreateCouponParams, CustomerLoyaltyMetafield, ShopLoyaltyValue } from "../types";
import type { Storefront } from "@shopify/hydrogen";

interface CollectionNode {
  id: string;
  bonusPoints: { value: string } | null;
}

interface StorefrontFixture {
  /** Shop loyalty value; `null` makes the SHOP query report no metafield. */
  shopLoyalty?: ShopLoyaltyValue | null;
  /** Variant price as the GraphQL string amount (e.g. `"10.00"`). */
  priceAmount?: string;
  /** ISO currency of the variant price; drives minor-unit decimal count. */
  currencyCode?: string;
  /** Collection bonus nodes returned for the product. */
  collections?: CollectionNode[];
}

/** A `Storefront` whose `query` answers the shop + product loyalty queries from the fixture. */
export function makeStorefront({
  shopLoyalty = null,
  priceAmount = "10.00",
  currencyCode = "USD",
  collections = [],
}: StorefrontFixture = {}): Storefront {
  function resolveQuery(query: string) {
    switch (query) {
      case SHOP_LOYALTY_QUERY:
        return { shop: { loyalty: shopLoyalty ? { value: JSON.stringify(shopLoyalty) } : null } };

      case PRODUCT_LOYALTY_QUERY:
        return {
          product: {
            id: "gid://shopify/Product/1",
            selectedOrFirstAvailableVariant: { price: { amount: priceAmount, currencyCode } },
            collections: { nodes: collections },
          },
        };

      default:
        throw new Error(`Unexpected query: ${query}`);
    }
  }

  return {
    CacheLong: () => ({}),
    query: async (query: string) => resolveQuery(query),
  } as unknown as Storefront;
}

interface LoyaltyClientFixture extends StorefrontFixture {
  /** Pre-built storefront; defaults to `makeStorefront(fixture)`. */
  storefront?: Storefront;
  /** Customer `getCustomerLoyalty` resolves to. */
  customerLoyalty?: CustomerLoyaltyMetafield | null;
  /** `api.createCoupon` implementation; defaults to a success carrying `DISCOUNT10`. */
  createCoupon?: (params: CreateCouponParams) => Promise<unknown>;
}

/** Builds an `EasyPointsClient` plus the `createCoupon` spy tests assert on. */
export function makeLoyaltyClient(fixture: LoyaltyClientFixture = {}) {
  const {
    storefront = makeStorefront(fixture),
    customerLoyalty = null,
    createCoupon = async () => ({ data: { code: "DISCOUNT10" } }),
  } = fixture;

  const createCouponSpy = vi.fn(createCoupon);

  const loyalty = {
    context: () => ({ storefront, customerAccount: {} as never }),
    getCustomerLoyalty: async () => customerLoyalty,
    api: {
      createCoupon: createCouponSpy,
    },
  } as unknown as EasyPointsClient;

  return {
    loyalty,
    storefront,
    createCoupon: createCouponSpy,
  };
}

/** Builds a cart line, defaulting to product `1` / handle `a-product`, quantity 1. */
export function makeLine(overrides: Partial<CartLine> = {}): CartLine {
  return {
    id: "gid://shopify/CartLine/1",
    quantity: 1,
    merchandise: {
      product: { id: "gid://shopify/Product/1", handle: "a-product" },
      selectedOptions: [],
    },
    ...overrides,
  };
}

interface CartState {
  /** Discount codes already on the cart (loyalty and otherwise). */
  discountCodes?: { code: string; applicable?: boolean }[];
  /** Cart attributes, e.g. the tracked loyalty code. */
  attributes?: { key: string; value?: string | null }[];
}

type CartGetResult = {
  lines: { nodes: CartLine[] };
  discountCodes: { code: string; applicable?: boolean }[];
  attributes: { key: string; value?: string | null }[];
};

/**
 * Builds the Hydrogen cart handler plus the `updateDiscountCodes` / `updateAttributes` spies tests
 * assert on. Seed existing discount codes / attributes via `state` to exercise the merge paths.
 */
export function makeCart(lines: CartLine[] = [makeLine()], state: CartState = {}) {
  const updateDiscountCodes = vi.fn(async () => ({}));
  const updateAttributes = vi.fn(async () => ({}));

  const cart = {
    get: async (): Promise<CartGetResult | null> => ({
      lines: { nodes: lines },
      discountCodes: state.discountCodes ?? [],
      attributes: state.attributes ?? [],
    }),
    updateDiscountCodes,
    updateAttributes,
  };

  return {
    cart,
    updateDiscountCodes,
    updateAttributes,
  };
}

type QueryResult = { data?: unknown; errors?: { message: string }[] };

/** A loyalty `Context` whose `customerAccount` implements only `isLoggedIn` + `query`. */
export function makeCustomerContext(account: {
  isLoggedIn?: () => Promise<boolean>;
  query?: () => Promise<QueryResult>;
}): Context {
  return {
    storefront: {},
    customerAccount: {
      isLoggedIn: account.isLoggedIn ?? (async () => true),
      query: account.query ?? (async () => ({ data: { customer: null } })),
    },
  } as unknown as Context;
}
