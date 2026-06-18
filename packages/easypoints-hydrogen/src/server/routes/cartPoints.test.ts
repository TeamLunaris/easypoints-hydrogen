import { describe, expect, test, vi } from "vite-plus/test";

import { PRODUCT_LOYALTY_QUERY, SHOP_LOYALTY_QUERY } from "../graphql";

import { ACTIONS, createCartPointsAction } from "./cartPoints";

import type { CartLine } from "./cartPoints";
import type { EasyPointsClient } from "../loyalty";
import type { CreateCouponParams, CustomerLoyaltyMetafield, ShopLoyaltyValue } from "../../types";
import type { Storefront } from "@shopify/hydrogen";

/** Minimal shop loyalty value; only `percentage` matters for the calculate-path math. */
function shopValue(percentage: number): ShopLoyaltyValue {
  return {
    live: true,
    percentage,
    currency_value: 100,
    point_value: 1,
    point_rules: {},
  };
}

/** Builds a cart line, defaulting to product `1` / handle `a-product`, quantity 1. */
function makeLine(overrides: Partial<CartLine> = {}): CartLine {
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

interface ContextFixture {
  lines?: CartLine[];
  customerLoyalty?: CustomerLoyaltyMetafield | null;
  /** Configures the `api.createCoupon` reply; defaults to a success carrying `DISCOUNT10`. */
  createCoupon?: (params: CreateCouponParams) => Promise<unknown>;
  /** Variant price (GraphQL string amount) the storefront fixture reports, for the calculate path. */
  priceAmount?: string;
  /** Shop loyalty value the storefront fixture reports; `null` makes `productPoints` resolve `null`. */
  shopLoyalty?: ShopLoyaltyValue | null;
}

/**
 * Builds the `{ cart, loyalty }` action context plus the spies tests assert on. The storefront
 * answers the shop + product loyalty queries (so the `CALCULATE_POINTS` path runs `productPoints`),
 * and `api.createCoupon` / `cart.updateDiscountCodes` are `vi.fn` spies.
 */
function makeContext({
  lines = [makeLine()],
  customerLoyalty = { customerId: "gid://shopify/Customer/1" } as CustomerLoyaltyMetafield,
  createCoupon = async () => ({ data: { code: "DISCOUNT10" } }),
  priceAmount = "10.00",
  shopLoyalty = shopValue(5),
}: ContextFixture = {}) {
  const updateDiscountCodes = vi.fn(async () => ({}));
  const createCouponSpy = vi.fn(createCoupon);

  const storefront = {
    CacheLong: () => ({}),
    query: async (query: string) => {
      if (query === SHOP_LOYALTY_QUERY) {
        return { shop: { loyalty: shopLoyalty ? { value: JSON.stringify(shopLoyalty) } : null } };
      }
      if (query === PRODUCT_LOYALTY_QUERY) {
        return {
          product: {
            id: "gid://shopify/Product/1",
            selectedOrFirstAvailableVariant: {
              price: { amount: priceAmount, currencyCode: "USD" },
            },
            collections: { nodes: [] },
          },
        };
      }
      throw new Error(`Unexpected query: ${query}`);
    },
  } as unknown as Storefront;

  const loyalty = {
    context: () => ({ storefront, customerAccount: {} as never }),
    getCustomerLoyalty: async () => customerLoyalty,
    api: { createCoupon: createCouponSpy },
  } as unknown as EasyPointsClient;

  const cart = {
    get: async (): Promise<{ lines: { nodes: CartLine[] } } | null> => ({
      lines: { nodes: lines },
    }),
    updateDiscountCodes,
  };

  return { context: { cart, loyalty }, cart, updateDiscountCodes, createCoupon: createCouponSpy };
}

/** Builds a POST request whose form body carries the given fields (e.g. `action`, `points`). */
function makeRequest(fields: Record<string, string>): Request {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }
  return new Request("https://shop.example/api/cart/points", { method: "POST", body: formData });
}

describe("dispatcher", () => {
  test("throws when the action field is missing", async () => {
    const action = createCartPointsAction();
    const { context } = makeContext();

    await expect(action({ context, request: makeRequest({}) })).rejects.toThrow(
      /Points action is missing/,
    );
  });

  test("throws on an unrecognized action", async () => {
    const action = createCartPointsAction();
    const { context } = makeContext();

    await expect(action({ context, request: makeRequest({ action: "Nope" }) })).rejects.toThrow(
      /Invalid points action/,
    );
  });

  test("UNDO_REDEEM clears the discount codes and resolves null", async () => {
    const action = createCartPointsAction();
    const { context, updateDiscountCodes } = makeContext();

    const result = await action({
      context,
      request: makeRequest({ action: ACTIONS.UNDO_REDEEM }),
    });

    expect(result).toBe(null);
    expect(updateDiscountCodes).toHaveBeenCalledWith([]);
  });
});

describe("CALCULATE_POINTS", () => {
  const calc = (
    action: ReturnType<typeof createCartPointsAction>,
    context: ReturnType<typeof makeContext>["context"],
  ) => action({ context, request: makeRequest({ action: ACTIONS.CALCULATE_POINTS }) });

  test("maps each eligible line to its points (price 10.00 @ 5% -> 50)", async () => {
    const action = createCartPointsAction();
    const { context } = makeContext({
      lines: [makeLine({ id: "line-1" }), makeLine({ id: "line-2" })],
    });

    expect(await calc(action, context)).toEqual({
      pointsMap: { "line-1": 50, "line-2": 50 },
    });
  });

  test("lineFilter excludes lines from the points map", async () => {
    const action = createCartPointsAction({ lineFilter: (line) => line.id !== "skip" });
    const { context } = makeContext({
      lines: [makeLine({ id: "keep" }), makeLine({ id: "skip" })],
    });

    expect(await calc(action, context)).toEqual({ pointsMap: { keep: 50 } });
  });

  test("resolves null when the cart is empty", async () => {
    const action = createCartPointsAction();
    const { context } = makeContext();
    context.cart.get = async () => null;

    expect(await calc(action, context)).toBe(null);
  });

  test("maps a line to null when its points are uncomputable", async () => {
    // No shop loyalty -> productPoints resolves null -> pointsMap entry is null (not omitted).
    const action = createCartPointsAction();
    const { context } = makeContext({ shopLoyalty: null });

    expect(await calc(action, context)).toEqual({
      pointsMap: { "gid://shopify/CartLine/1": null },
    });
  });
});

describe("REDEEM_POINTS", () => {
  const redeem = (
    action: ReturnType<typeof createCartPointsAction>,
    context: ReturnType<typeof makeContext>["context"],
    points: string,
  ) => action({ context, request: makeRequest({ action: ACTIONS.REDEEM_POINTS, points }) });

  test("creates a coupon and applies its code on success", async () => {
    const action = createCartPointsAction();
    const { context, updateDiscountCodes, createCoupon } = makeContext();

    const result = await redeem(action, context, "100");

    expect(result).toEqual({ success: true, points: 100 });
    expect(createCoupon).toHaveBeenCalledWith({
      customerId: "gid://shopify/Customer/1",
      pointValue: 100,
      productIds: ["1"],
    });
    expect(updateDiscountCodes).toHaveBeenCalledWith(["DISCOUNT10"]);
  });

  test("dedupes product ids and honors lineFilter when building the coupon", async () => {
    const action = createCartPointsAction({
      lineFilter: (line) => line.merchandise.product.id !== "gid://shopify/Product/3",
    });
    const { context, createCoupon } = makeContext({
      lines: [
        makeLine({ id: "l1" }), // product 1
        makeLine({
          id: "l2",
          merchandise: {
            product: { id: "gid://shopify/Product/1", handle: "a" },
            selectedOptions: [],
          },
        }), // product 1 again -> deduped
        makeLine({
          id: "l3",
          merchandise: {
            product: { id: "gid://shopify/Product/2", handle: "b" },
            selectedOptions: [],
          },
        }), // product 2
        makeLine({
          id: "l4",
          merchandise: {
            product: { id: "gid://shopify/Product/3", handle: "c" },
            selectedOptions: [],
          },
        }), // product 3 -> filtered out
      ],
    });

    await redeem(action, context, "50");

    expect(createCoupon).toHaveBeenCalledWith({
      customerId: "gid://shopify/Customer/1",
      pointValue: 50,
      productIds: ["1", "2"],
    });
  });

  test("throws when the customer is not authenticated", async () => {
    const action = createCartPointsAction();
    const { context } = makeContext({ customerLoyalty: null });

    await expect(redeem(action, context, "100")).rejects.toThrow(/not authenticated/);
  });

  test("rejects non-integer points without calling the API", async () => {
    const action = createCartPointsAction();
    const { context, createCoupon, updateDiscountCodes } = makeContext();

    expect(await redeem(action, context, "1.5")).toEqual({ success: false, points: 1.5 });
    expect(createCoupon).not.toHaveBeenCalled();
    expect(updateDiscountCodes).not.toHaveBeenCalled();
  });

  test("rejects a non-numeric points value (NaN) without calling the API", async () => {
    const action = createCartPointsAction();
    const { context, createCoupon } = makeContext();

    expect(await redeem(action, context, "abc")).toEqual({ success: false, points: NaN });
    expect(createCoupon).not.toHaveBeenCalled();
  });

  test("rejects zero / negative points without calling the API", async () => {
    const action = createCartPointsAction();
    const { context, createCoupon } = makeContext();

    expect(await redeem(action, context, "0")).toEqual({ success: false, points: 0 });
    expect(await redeem(action, context, "-5")).toEqual({ success: false, points: -5 });
    expect(createCoupon).not.toHaveBeenCalled();
  });

  test("short-circuits with empty_cart when the cart is null, without calling the API", async () => {
    const action = createCartPointsAction();
    const { context, createCoupon, updateDiscountCodes } = makeContext();
    context.cart.get = async () => null;

    expect(await redeem(action, context, "100")).toEqual({
      success: false,
      points: 100,
      error: { code: "empty_cart", message: "Cart has no eligible lines to redeem against" },
    });
    expect(createCoupon).not.toHaveBeenCalled();
    expect(updateDiscountCodes).not.toHaveBeenCalled();
  });

  test("short-circuits with empty_cart when every line is filtered out", async () => {
    const action = createCartPointsAction({ lineFilter: () => false });
    const { context, createCoupon } = makeContext();

    expect(await redeem(action, context, "100")).toEqual({
      success: false,
      points: 100,
      error: { code: "empty_cart", message: "Cart has no eligible lines to redeem against" },
    });
    expect(createCoupon).not.toHaveBeenCalled();
  });

  test("surfaces a redemption_failed error joining the API error messages", async () => {
    const action = createCartPointsAction();
    const { context, updateDiscountCodes } = makeContext({
      createCoupon: async () => ({
        errors: ["too few points", "blocked"],
        status: 422,
        title: "Unprocessable Entity",
      }),
    });

    expect(await redeem(action, context, "100")).toEqual({
      success: false,
      points: 100,
      error: { code: "redemption_failed", message: "too few points, blocked" },
    });
    expect(updateDiscountCodes).not.toHaveBeenCalled();
  });

  test("falls back to the error title when the errors array is empty", async () => {
    const action = createCartPointsAction();
    const { context } = makeContext({
      createCoupon: async () => ({ errors: [], status: 422, title: "Unprocessable Entity" }),
    });

    expect(await redeem(action, context, "100")).toEqual({
      success: false,
      points: 100,
      error: { code: "redemption_failed", message: "Unprocessable Entity" },
    });
  });

  test("surfaces coupon_creation_failed when the response has no code", async () => {
    const action = createCartPointsAction();
    const { context, updateDiscountCodes } = makeContext({
      createCoupon: async () => ({ data: { code: "" } }),
    });

    expect(await redeem(action, context, "100")).toEqual({
      success: false,
      points: 100,
      error: { code: "coupon_creation_failed", message: "Coupon could not be created" },
    });
    expect(updateDiscountCodes).not.toHaveBeenCalled();
  });

  test("surfaces coupon_creation_failed when the response carries neither errors nor data", async () => {
    const action = createCartPointsAction();
    const { context } = makeContext({ createCoupon: async () => ({}) });

    expect(await redeem(action, context, "100")).toEqual({
      success: false,
      points: 100,
      error: { code: "coupon_creation_failed", message: "Coupon could not be created" },
    });
  });
});
