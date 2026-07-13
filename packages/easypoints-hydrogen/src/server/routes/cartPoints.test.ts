import { describe, expect, test, vi } from "vite-plus/test";

import { createCartPointsAction } from "./cartPoints";
import { EasyPointsClientError } from "../errors";
import { CART_POINTS_ACTIONS as ACTIONS } from "../../shared/cartPoints";

import { makeCart, makeLine, makeLoyaltyClient } from "../../test-support/context";
import { shopValue } from "../../test-support/fixtures/shop";

import type { CartLine } from "./cartPoints";
import type { CreateCouponParams, CustomerLoyaltyMetafield, ShopLoyaltyValue } from "../../types";

interface ContextFixture {
  lines?: CartLine[];
  customerLoyalty?: CustomerLoyaltyMetafield | null;
  /** Configures the `api.createCoupon` reply; defaults to a success carrying `DISCOUNT10`. */
  createCoupon?: (params: CreateCouponParams) => Promise<unknown>;
  /** Variant price (GraphQL string amount) the storefront fixture reports, for the calculate path. */
  priceAmount?: string;
  /** Shop loyalty value the storefront fixture reports; `null` makes `productPoints` resolve `null`. */
  shopLoyalty?: ShopLoyaltyValue | null;
  /** Discount codes already on the cart (exercises the merge paths). */
  discountCodes?: { code: string; applicable?: boolean }[];
  /** Cart attributes already on the cart (e.g. a tracked loyalty code). */
  attributes?: { key: string; value?: string | null }[];
}

/**
 * Builds the `{ cart, loyalty }` action context plus the spies tests assert on. The storefront
 * answers the shop + product loyalty queries (so the `CALCULATE_POINTS` path runs `productPoints`),
 * and `api.createCoupon` / `cart.updateDiscountCodes` are `vi.fn` spies.
 */
function makeContext({
  lines = [makeLine()],
  customerLoyalty = { customerId: "gid://shopify/Customer/1" } as CustomerLoyaltyMetafield,
  createCoupon,
  priceAmount = "10.00",
  shopLoyalty = shopValue(5),
  discountCodes,
  attributes,
}: ContextFixture = {}) {
  const { loyalty, createCoupon: createCouponSpy } = makeLoyaltyClient({
    customerLoyalty,
    createCoupon,
    priceAmount,
    shopLoyalty,
  });
  const { cart, updateDiscountCodes, updateAttributes } = makeCart(lines, {
    discountCodes,
    attributes,
  });

  return {
    context: { cart, loyalty },
    cart,
    updateDiscountCodes,
    updateAttributes,
    createCoupon: createCouponSpy,
  };
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

  test("UNDO_REDEEM removes only the tracked loyalty code and resolves null", async () => {
    const action = createCartPointsAction();
    const { context, updateDiscountCodes, updateAttributes } = makeContext({
      discountCodes: [{ code: "DISCOUNT10" }, { code: "PROMO20" }],
      attributes: [{ key: "_loyaltyDiscountCode", value: "DISCOUNT10" }],
    });

    const result = await action({
      context,
      request: makeRequest({ action: ACTIONS.UNDO_REDEEM }),
    });

    expect(result).toBe(null);
    // Loyalty code dropped, the customer's other discount preserved.
    expect(updateDiscountCodes).toHaveBeenCalledWith(["PROMO20"]);
    expect(updateAttributes).toHaveBeenCalledWith([{ key: "_loyaltyDiscountCode", value: "" }]);
  });

  test("UNDO_REDEEM with no tracked code leaves existing codes untouched", async () => {
    const action = createCartPointsAction();
    const { context, updateDiscountCodes } = makeContext({
      discountCodes: [{ code: "PROMO20" }],
    });

    await action({ context, request: makeRequest({ action: ACTIONS.UNDO_REDEEM }) });

    expect(updateDiscountCodes).toHaveBeenCalledWith(["PROMO20"]);
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

  test("resolves an empty points map when there is no cart", async () => {
    const action = createCartPointsAction();
    const { context } = makeContext();
    context.cart.get = async () => null;

    expect(await calc(action, context)).toEqual({ pointsMap: {} });
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
    // The customer GID is parsed to the numeric id the coupon API expects (it 422s on GIDs).
    expect(createCoupon).toHaveBeenCalledWith({
      customerId: "1",
      pointValue: 100,
      productIds: ["1"],
    });
    expect(updateDiscountCodes).toHaveBeenCalledWith(["DISCOUNT10"]);
  });

  test("records the applied code in the loyalty cart attribute", async () => {
    const action = createCartPointsAction();
    const { context, updateAttributes } = makeContext();

    await redeem(action, context, "100");

    expect(updateAttributes).toHaveBeenCalledWith([
      { key: "_loyaltyDiscountCode", value: "DISCOUNT10" },
    ]);
  });

  test("merges the loyalty code with existing non-loyalty codes", async () => {
    const action = createCartPointsAction();
    const { context, updateDiscountCodes } = makeContext({
      discountCodes: [{ code: "PROMO20" }],
    });

    await redeem(action, context, "100");

    // The customer's PROMO20 survives; the loyalty code is appended.
    expect(updateDiscountCodes).toHaveBeenCalledWith(["PROMO20", "DISCOUNT10"]);
  });

  test("replaces a prior loyalty code instead of stacking it", async () => {
    const action = createCartPointsAction();
    const { context, updateDiscountCodes } = makeContext({
      discountCodes: [{ code: "OLDLOYALTY" }, { code: "PROMO20" }],
      attributes: [{ key: "_loyaltyDiscountCode", value: "OLDLOYALTY" }],
    });

    await redeem(action, context, "100");

    // OLDLOYALTY (the tracked prior code) is dropped, PROMO20 kept, new code appended.
    expect(updateDiscountCodes).toHaveBeenCalledWith(["PROMO20", "DISCOUNT10"]);
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
      customerId: "1",
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

    expect(await redeem(action, context, "1.5")).toEqual({
      success: false,
      points: 1.5,
      error: { code: "invalid_points", message: "Points must be a positive integer" },
    });
    expect(createCoupon).not.toHaveBeenCalled();
    expect(updateDiscountCodes).not.toHaveBeenCalled();
  });

  test("rejects a non-numeric points value (NaN) without calling the API", async () => {
    const action = createCartPointsAction();
    const { context, createCoupon } = makeContext();

    expect(await redeem(action, context, "abc")).toEqual({
      success: false,
      points: 0,
      error: { code: "invalid_points", message: "Points must be a positive integer" },
    });
    expect(createCoupon).not.toHaveBeenCalled();
  });

  test("rejects zero / negative points without calling the API", async () => {
    const action = createCartPointsAction();
    const { context, createCoupon } = makeContext();

    const invalidPointsError = {
      code: "invalid_points",
      message: "Points must be a positive integer",
    };
    expect(await redeem(action, context, "0")).toEqual({
      success: false,
      points: 0,
      error: invalidPointsError,
    });
    expect(await redeem(action, context, "-5")).toEqual({
      success: false,
      points: -5,
      error: invalidPointsError,
    });
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

  test("surfaces loyalty_unavailable when the API 5xxes (client throws)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const action = createCartPointsAction();
    const { context, updateDiscountCodes } = makeContext({
      createCoupon: async () => {
        throw new EasyPointsClientError({
          endpoint: "/shopify/coupons",
          response: new Response(null, { status: 500, statusText: "Internal Server Error" }),
        });
      },
    });

    expect(await redeem(action, context, "100")).toEqual({
      success: false,
      points: 100,
      error: {
        code: "loyalty_unavailable",
        message: "The loyalty service is temporarily unavailable. Please try again later.",
      },
    });
    expect(updateDiscountCodes).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });

  test("surfaces loyalty_unavailable when the API is unreachable (fetch rejects)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const action = createCartPointsAction();
    const { context, updateDiscountCodes, updateAttributes } = makeContext({
      createCoupon: async () => {
        throw new Error("network down");
      },
    });

    expect(await redeem(action, context, "100")).toEqual({
      success: false,
      points: 100,
      error: {
        code: "loyalty_unavailable",
        message: "The loyalty service is temporarily unavailable. Please try again later.",
      },
    });
    expect(updateDiscountCodes).not.toHaveBeenCalled();
    expect(updateAttributes).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
