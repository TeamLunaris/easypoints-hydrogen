import { parseGid } from "@shopify/hydrogen";

import { CustomerNotAuthenticatedError } from "../errors";
import { productPoints } from "../product";
// Browser-safe route contract (action ids + response types). The server handler and the client
// hooks share this single source of truth; see `shared/cartPoints`.
import { CART_POINTS_ACTIONS as ACTIONS } from "../../shared/cartPoints";

import type { EasyPointsClient } from "../loyalty";
import type { CalculatePointsResponse, RedeemPointsResponse } from "../../shared/cartPoints";
import type { SelectedOptionInput } from "@shopify/hydrogen/storefront-api-types";

/**
 * Cart attribute key that records the discount code applied by the most recent redemption. Lets
 * `UNDO_REDEEM` remove only the loyalty code (and `REDEEM_POINTS` replace a prior one) without
 * clobbering other discount codes the customer has on the cart. Leading underscore marks it private
 * to Shopify (hidden from the storefront).
 */
export const LOYALTY_DISCOUNT_CODE_ATTRIBUTE = "_loyaltyDiscountCode";

/** A cart line, narrowed to the fields the points actions read. */
export interface CartLine {
  id: string;
  quantity: number;
  merchandise: {
    product: { id: string; handle: string };
    selectedOptions: SelectedOptionInput[];
  };
}

/** Cart shape returned by `cart.get()`, narrowed to the fields the points actions read. */
type CartData = {
  lines?: { nodes?: CartLine[] } | null;
  discountCodes?: { code: string; applicable?: boolean }[] | null;
  attributes?: { key: string; value?: string | null }[] | null;
} | null;

/** The Hydrogen cart handler surface the actions use. */
interface Cart {
  get: () => Promise<CartData>;
  updateDiscountCodes: (codes: string[]) => Promise<unknown>;
  updateAttributes: (attributes: { key: string; value: string }[]) => Promise<unknown>;
}

/** The request context the dispatcher operates against. */
interface ActionContext {
  cart: Cart;
  loyalty: EasyPointsClient;
}

/** Args passed to the returned `action` dispatcher (mirrors a React Router action). */
interface ActionArgs {
  request: Request;
  context: ActionContext;
}

/** Options for {@link createCartPointsAction}. */
export interface CreateCartPointsActionOptions {
  /**
   * Predicate selecting which cart lines participate in points math and redemption. Defaults to
   * including every line. Use it to exclude lines the merchant doesn't reward (e.g. shipping
   * protection): `lineFilter: (line) => line.merchandise.product.id !== PROTECTION_ID`.
   */
  lineFilter?: (line: CartLine) => boolean;
}

/**
 * Builds the cart points `action` dispatcher.
 *
 * The returned function is mounted as the `action` of a resource route (default path
 * {@link CART_POINTS_ROUTE_PATH}). It reads the `action` form field and dispatches to one of
 * {@link ACTIONS}:
 * - `CALCULATE_POINTS` → `{ pointsMap }` keyed by line id;
 * - `REDEEM_POINTS` → creates a coupon, merges its code into the cart's existing discount codes
 *   (replacing a prior loyalty code, preserving the rest), and records it in the
 *   {@link LOYALTY_DISCOUNT_CODE_ATTRIBUTE} cart attribute;
 * - `UNDO_REDEEM` → removes only the tracked loyalty discount code, leaving other codes intact.
 *
 * @param options - See {@link CreateCartPointsActionOptions} (notably `lineFilter`).
 * @returns The `action` dispatcher.
 */
export function createCartPointsAction(options: CreateCartPointsActionOptions = {}) {
  const lineFilter = options.lineFilter ?? (() => true);

  /** Returns the cart's eligible lines (after `lineFilter`). */
  function eligibleLines(cart: CartData): CartLine[] {
    return (cart?.lines?.nodes ?? []).filter(lineFilter);
  }

  /** All discount codes currently on the cart, loyalty and otherwise. */
  function existingDiscountCodes(cart: CartData): string[] {
    return (cart?.discountCodes ?? []).map((dc) => dc.code);
  }

  /** The loyalty code recorded by the last redemption, or `null` if none is tracked. */
  function trackedLoyaltyCode(cart: CartData): string | null {
    const attr = (cart?.attributes ?? []).find((a) => a.key === LOYALTY_DISCOUNT_CODE_ATTRIBUTE);
    return attr?.value || null;
  }

  /**
   * Calculates the total loyalty points for each eligible line in the current cart.
   */
  async function calculatePoints(context: ActionContext): Promise<CalculatePointsResponse> {
    const cart = await context.cart.get();
    const cartLines = eligibleLines(cart);

    // COMBAK: if possible this should be done in a single query
    const points = await Promise.all(
      cartLines.map((line) =>
        productPoints(context.loyalty, {
          handle: line.merchandise.product.handle,
          selectedOptions: line.merchandise.selectedOptions,
          quantity: line.quantity,
        }),
      ),
    );

    const pointsMap: CalculatePointsResponse["pointsMap"] = {};
    cartLines.forEach((line, index) => {
      pointsMap[line.id] = points[index]?.totalPoints ?? null;
    });

    return { pointsMap };
  }

  /**
   * Redeems points into a discount code and applies it to the cart.
   */
  async function redeemPoints(
    context: ActionContext,
    formData: FormData,
  ): Promise<RedeemPointsResponse> {
    const loyalty = await context.loyalty.getCustomerLoyalty();
    if (!loyalty) throw new CustomerNotAuthenticatedError();

    const points = Number(formData.get("points"));
    if (!Number.isInteger(points) || points <= 0) {
      return {
        success: false,
        error: { code: "invalid_points", message: "Points must be a positive integer" },
        // Echo the attempted value, but coerce non-numeric input (NaN/Infinity) to 0 so we never
        // return NaN (which serializes to null) to the client.
        points: Number.isFinite(points) ? points : 0,
      };
    }

    const cart = await context.cart.get();
    const productIds = eligibleLines(cart).map((line) => parseGid(line.merchandise.product.id).id);

    if (productIds.length === 0) {
      return {
        success: false,
        error: { code: "empty_cart", message: "Cart has no eligible lines to redeem against" },
        points,
      };
    }

    const resp = await context.loyalty.api.createCoupon({
      productIds: Array.from(new Set(productIds)),
      customerId: loyalty.customerId,
      pointValue: points,
    });

    if ("errors" in resp) {
      const message = resp.errors?.length ? resp.errors.join(", ") : resp.title;

      return {
        success: false,
        error: { code: "redemption_failed", message },
        points,
      };
    }

    if ("data" in resp && resp.data?.code) {
      const newCode = resp.data.code;

      // Merge our code into the cart's existing codes rather than replacing them — preserve any
      // non-loyalty discount the customer applied, and drop a prior loyalty code so repeat
      // redemptions don't stack. Record the applied code so UNDO_REDEEM can remove just this one.
      const priorCode = trackedLoyaltyCode(cart);
      const kept = existingDiscountCodes(cart).filter(
        (code) => code !== priorCode && code !== newCode,
      );

      // Run both updates concurrently: a cart provably exists here (we created a coupon against
      // its lines), so neither call hits the handler's lazy-create branch, and they write disjoint
      // cart fields (discount codes vs. attributes), so there's no race to lose.
      await Promise.all([
        context.cart.updateDiscountCodes([...kept, newCode]),
        context.cart.updateAttributes([{ key: LOYALTY_DISCOUNT_CODE_ATTRIBUTE, value: newCode }]),
      ]);

      return {
        success: true,
        points,
      };
    }

    return {
      success: false,
      error: { code: "coupon_creation_failed", message: "Coupon could not be created" },
      points,
    };
  }

  /**
   * Removes the tracked loyalty discount code, undoing a redemption while leaving any other
   * discount codes on the cart intact.
   */
  async function undoRedeem(context: ActionContext): Promise<null> {
    const cart = await context.cart.get();
    const loyaltyCode = trackedLoyaltyCode(cart);

    const kept = existingDiscountCodes(cart).filter((code) => code !== loyaltyCode);

    await Promise.all([
      context.cart.updateDiscountCodes(kept),
      context.cart.updateAttributes([{ key: LOYALTY_DISCOUNT_CODE_ATTRIBUTE, value: "" }]),
    ]);
    return null;
  }

  return async function action<T extends ActionArgs>({ context, request }: T) {
    const formData = await request.formData();
    const actionType = formData.get("action") as string | null;

    if (!actionType) {
      throw new Error(
        `Points action is missing. Expected one of: ${Object.values(ACTIONS).join(", ")}.`,
      );
    }

    switch (actionType) {
      case ACTIONS.CALCULATE_POINTS:
        return calculatePoints(context);

      case ACTIONS.REDEEM_POINTS:
        return redeemPoints(context, formData);

      case ACTIONS.UNDO_REDEEM:
        return undoRedeem(context);

      default:
        throw new Error(
          `Invalid points action. Expected one of: ${Object.values(ACTIONS).join(", ")}.`,
        );
    }
  };
}
