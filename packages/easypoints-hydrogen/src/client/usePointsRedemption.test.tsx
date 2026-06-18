// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import { EasyPointsProvider } from "./context";
import { usePointsRedemption } from "./hooks/usePointsRedemption";

import type { EasyPointsConfig } from "./context";
import type { RedeemPointsResponse } from "../server/routes/cartPoints";
import type { CustomerLoyaltyMetafield } from "../types";
import type { ReactNode } from "react";

// A single mutable fetcher stands in for `useFetcher`. Tests drive it by mutating `data` / `state`
// and re-rendering, then assert on `submit`.
const mock = vi.hoisted(() => {
  const submit = vi.fn();
  const fetcher: {
    data: RedeemPointsResponse | null | undefined;
    state: string;
    submit: typeof submit;
  } = { data: undefined, state: "idle", submit };
  return { submit, fetcher };
});

vi.mock("react-router", () => ({
  useFetcher: () => mock.fetcher,
}));

beforeEach(() => {
  mock.fetcher.data = undefined;
  mock.fetcher.state = "idle";
  mock.submit.mockClear();
});

const ROUTE = { method: "POST", action: "/api/cart/points" };

// Only `.balance` is read via the provider fallback; cast keeps the fixture small.
const account = (balance: number) => ({ balance }) as CustomerLoyaltyMetafield;

const wrapper =
  (config: EasyPointsConfig) =>
  ({ children }: { children: ReactNode }) => (
    <EasyPointsProvider {...config}>{children}</EasyPointsProvider>
  );

describe("usePointsRedemption", () => {
  describe("input validation", () => {
    test("accepts a positive integer within balance", () => {
      const { result } = renderHook(() => usePointsRedemption({ pointsBalance: 1000 }));

      act(() => result.current.setPointsToRedeem("500"));
      expect(result.current.canRedeem).toBe(true);
    });

    test("rejects values above the balance", () => {
      const { result } = renderHook(() => usePointsRedemption({ pointsBalance: 1000 }));

      act(() => result.current.setPointsToRedeem("1001"));
      expect(result.current.canRedeem).toBe(false);
    });

    test("rejects non-positive values", () => {
      const { result } = renderHook(() => usePointsRedemption({ pointsBalance: 1000 }));

      act(() => result.current.setPointsToRedeem("0"));
      expect(result.current.canRedeem).toBe(false);

      act(() => result.current.setPointsToRedeem("-5"));
      expect(result.current.canRedeem).toBe(false);
    });

    test("rejects non-integer values", () => {
      const { result } = renderHook(() => usePointsRedemption({ pointsBalance: 1000 }));

      act(() => result.current.setPointsToRedeem("3.5"));
      expect(result.current.canRedeem).toBe(false);
    });

    test("rejects everything while the cart is optimistic", () => {
      const { result } = renderHook(() =>
        usePointsRedemption({ pointsBalance: 1000, isOptimistic: true }),
      );

      act(() => result.current.setPointsToRedeem("500"));
      expect(result.current.canRedeem).toBe(false);
    });
  });

  describe("adaptive stepper", () => {
    test.each([
      [50, 1],
      [100, 10],
      [1000, 100],
      [5000, 500],
    ])("balance %i -> step %i", (balance, expectedStep) => {
      const { result } = renderHook(() => usePointsRedemption({ pointsBalance: balance }));
      expect(result.current.step).toBe(expectedStep);
    });
  });

  describe("redeem", () => {
    test("submits the REDEEM action and surfaces redeemedPoints on success", () => {
      const { result, rerender } = renderHook(() =>
        usePointsRedemption({ pointsBalance: 1000, customerId: "gid://shopify/Customer/1" }),
      );

      act(() => result.current.setPointsToRedeem("300"));
      act(() => result.current.redeem());

      expect(mock.submit).toHaveBeenCalledWith(
        { action: "RedeemPoints", points: 300, customerId: "gid://shopify/Customer/1" },
        ROUTE,
      );

      mock.fetcher.data = { success: true, points: 300 };
      act(() => rerender());

      expect(result.current.redeemedPoints).toBe(300);
      expect(result.current.error).toBe(null);
    });

    test("does not submit when the input is invalid", () => {
      const { result } = renderHook(() => usePointsRedemption({ pointsBalance: 100 }));

      // redeem() guards only on isOptimistic, but callers gate on canRedeem; assert the value.
      act(() => result.current.setPointsToRedeem("500"));
      expect(result.current.canRedeem).toBe(false);
    });
  });

  describe("undo", () => {
    test("submits the UNDO action and clears redeemed state", () => {
      const { result, rerender } = renderHook(() => usePointsRedemption({ pointsBalance: 1000 }));

      mock.fetcher.data = { success: true, points: 200 };
      act(() => rerender());
      expect(result.current.redeemedPoints).toBe(200);

      act(() => result.current.undo());

      expect(mock.submit).toHaveBeenCalledWith({ action: "UndoRedeem" }, ROUTE);
      expect(result.current.redeemedPoints).toBe(null);
    });
  });

  describe("error", () => {
    test("populates from a structured error response", () => {
      const { result, rerender } = renderHook(() => usePointsRedemption({ pointsBalance: 1000 }));

      mock.fetcher.data = {
        success: false,
        points: 0,
        error: { code: "redemption_failed", message: "Coupon could not be created" },
      };
      act(() => rerender());

      expect(result.current.error).toEqual({
        code: "redemption_failed",
        message: "Coupon could not be created",
      });
      expect(result.current.redeemedPoints).toBe(null);
    });

    test("clears a previous error when a new submit starts", () => {
      const { result, rerender } = renderHook(() => usePointsRedemption({ pointsBalance: 1000 }));

      mock.fetcher.data = { success: false, points: 0, error: { message: "nope" } };
      act(() => rerender());
      expect(result.current.error).not.toBe(null);

      mock.fetcher.state = "submitting";
      act(() => rerender());
      expect(result.current.error).toBe(null);
    });
  });

  describe("isSubmitting", () => {
    test("reflects the fetcher submitting state", () => {
      mock.fetcher.state = "submitting";
      const { result } = renderHook(() => usePointsRedemption({ pointsBalance: 1000 }));
      expect(result.current.isSubmitting).toBe(true);
    });
  });

  describe("optimistic guard", () => {
    test("redeem() is a no-op while the cart is optimistic", () => {
      const { result } = renderHook(() =>
        usePointsRedemption({ pointsBalance: 1000, isOptimistic: true }),
      );

      act(() => result.current.setPointsToRedeem("100"));
      act(() => result.current.redeem());

      expect(mock.submit).not.toHaveBeenCalled();
    });
  });

  describe("cart-change auto-undo", () => {
    test("submits UNDO on mount and again when the cart quantity changes", () => {
      let qty = 2;
      const { rerender } = renderHook(() =>
        usePointsRedemption({ pointsBalance: 1000, cartTotalQuantity: qty }),
      );

      expect(mock.submit).toHaveBeenCalledWith({ action: "UndoRedeem" }, ROUTE);
      expect(mock.submit).toHaveBeenCalledTimes(1);

      qty = 3;
      act(() => rerender());
      expect(mock.submit).toHaveBeenCalledTimes(2);
    });

    test("does not auto-undo when cartTotalQuantity is omitted", () => {
      renderHook(() => usePointsRedemption({ pointsBalance: 1000 }));
      expect(mock.submit).not.toHaveBeenCalled();
    });
  });

  describe("provider fallback", () => {
    test("reads balance, customerId, and route from the provider", () => {
      const { result } = renderHook(() => usePointsRedemption(), {
        wrapper: wrapper({
          route: "/custom/cart/points",
          customerId: "gid://shopify/Customer/42",
          customerLoyalty: account(800),
        }),
      });

      act(() => result.current.setPointsToRedeem("800"));
      expect(result.current.canRedeem).toBe(true);

      act(() => result.current.redeem());
      expect(mock.submit).toHaveBeenCalledWith(
        { action: "RedeemPoints", points: 800, customerId: "gid://shopify/Customer/42" },
        { method: "POST", action: "/custom/cart/points" },
      );
    });

    test("explicit params win over the provider", () => {
      const { result } = renderHook(() => usePointsRedemption({ pointsBalance: 50 }), {
        wrapper: wrapper({ customerLoyalty: account(800) }),
      });

      act(() => result.current.setPointsToRedeem("800"));
      // 800 exceeds the explicit balance of 50, so the provider's 800 is not used.
      expect(result.current.canRedeem).toBe(false);
    });
  });
});
