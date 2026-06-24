import { parseGid } from "@shopify/hydrogen";

import { CustomerNotAuthenticatedError } from "../errors";
import { productPoints } from "../product";

import type { EasyPointsClient } from "../loyalty";
import type { SelectedOptionInput } from "@shopify/hydrogen/storefront-api-types";

/** Default path the merchant should mount the resource route at. Consumed type-side by the client hooks. */
export const CART_POINTS_ROUTE_PATH = "/api/cart/points";

/** The `action` form-field values the dispatcher switches on. */
export const ACTIONS = {
  CALCULATE_POINTS: "CalculatePoints",
  REDEEM_POINTS: "RedeemPoints",
  UNDO_REDEEM: "UndoRedeem",
} as const;

/** A cart line, narrowed to the fields the points actions read. */
export interface CartLine {
  id: string;
  quantity: number;
  merchandise: {
    product: { id: string; handle: string };
    selectedOptions: SelectedOptionInput[];
  };
}

/** Cart shape returned by `cart.get()`, narrowed to its line nodes. */
type CartData = { lines?: { nodes?: CartLine[] } | null } | null;

/** The Hydrogen cart handler surface the actions use. */
interface Cart {
  get: () => Promise<CartData>;
  updateDiscountCodes: (codes: string[]) => Promise<unknown>;
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

/** Structured error returned by the redeem action (replaces the source's `t::` strings). */
export interface PointsActionError {
  code?: string;
  message: string;
}

type PointsMap = Record<string, number | null>;
/** Response for the `CALCULATE_POINTS` action: line id → points (or `null` when uncomputable). */
export type CalculatePointsResponse = { pointsMap: PointsMap } | null;

/** Response for the `REDEEM_POINTS` action. */
export interface RedeemPointsResponse {
  success: boolean;
  points: number;
  error?: PointsActionError;
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
 * - `REDEEM_POINTS` → creates a coupon then applies its code via `cart.updateDiscountCodes`;
 * - `UNDO_REDEEM` → clears the cart's discount codes.
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

  /**
   * Calculates the total loyalty points for each eligible line in the current cart.
   */
  async function calculatePoints(context: ActionContext): Promise<CalculatePointsResponse> {
    const cart = await context.cart.get();
    if (!cart) return null;

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

    const pointsMap: PointsMap = {};
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
    const customerId = loyalty.customerId;

    const points = Number(formData.get("points"));

    if (!Number.isInteger(points) || points <= 0) {
      return { success: false, points };
    }

    const cart = await context.cart.get();
    const productIds = eligibleLines(cart).map((line) => parseGid(line.merchandise.product.id).id);

    if (productIds.length === 0) {
      return {
        success: false,
        points,
        error: { code: "empty_cart", message: "Cart has no eligible lines to redeem against" },
      };
    }

    const resp = await context.loyalty.api.createCoupon({
      productIds: Array.from(new Set(productIds)),
      customerId,
      pointValue: points,
    });

    if ("errors" in resp) {
      const message = resp.errors?.length ? resp.errors.join(", ") : resp.title;

      return {
        success: false,
        points,
        error: { code: "redemption_failed", message },
      };
    }

    if ("data" in resp && resp.data?.code) {
      await context.cart.updateDiscountCodes([resp.data.code]);

      return {
        success: true,
        points,
      };
    }

    return {
      success: false,
      points,
      error: { code: "coupon_creation_failed", message: "Coupon could not be created" },
    };
  }

  /**
   * Clears the cart's discount codes, undoing a redemption.
   */
  async function undoRedeem(context: ActionContext): Promise<null> {
    await context.cart.updateDiscountCodes([]);
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
