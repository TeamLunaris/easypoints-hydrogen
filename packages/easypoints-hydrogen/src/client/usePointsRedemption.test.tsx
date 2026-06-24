// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import { EasyPointsProvider } from "./context";
import { usePointsRedemption } from "./hooks/usePointsRedemption";

import type { EasyPointsContext } from "./context";
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
  (value: EasyPointsContext) =>
  ({ children }: { children: ReactNode }) => (
    <EasyPointsProvider {...value}>{children}</EasyPointsProvider>
  );

describe("usePointsRedemption", () => {
  describe("input validation + clamping", () => {
    test("accepts a positive integer within balance", () => {
      const { result } = renderHook(() => usePointsRedemption({ pointsBalance: 1000 }));

      act(() => result.current.input.setValue("500"));
      expect(result.current.input.value).toBe("500");
      expect(result.current.form.isValid).toBe(true);
    });

    test("clamps values above the balance down to the balance", () => {
      const { result } = renderHook(() => usePointsRedemption({ pointsBalance: 1000 }));

      act(() => result.current.input.setValue("1001"));
      expect(result.current.input.value).toBe("1000");
      expect(result.current.form.isValid).toBe(true);
    });

    test("clamps non-positive values to empty (not submittable)", () => {
      const { result } = renderHook(() => usePointsRedemption({ pointsBalance: 1000 }));

      act(() => result.current.input.setValue("0"));
      expect(result.current.input.value).toBe("");
      expect(result.current.form.isValid).toBe(false);

      act(() => result.current.input.setValue("-5"));
      expect(result.current.input.value).toBe("");
      expect(result.current.form.isValid).toBe(false);
    });

    test("truncates non-integer input to an integer", () => {
      const { result } = renderHook(() => usePointsRedemption({ pointsBalance: 1000 }));

      act(() => result.current.input.setValue("3.5"));
      expect(result.current.input.value).toBe("3");
      expect(result.current.form.isValid).toBe(true);
    });

    test("clears non-numeric input to empty", () => {
      const { result } = renderHook(() => usePointsRedemption({ pointsBalance: 1000 }));

      act(() => result.current.input.setValue("abc"));
      expect(result.current.input.value).toBe("");
      expect(result.current.form.isValid).toBe(false);
    });

    test("rejects everything while the cart is optimistic", () => {
      const { result } = renderHook(() =>
        usePointsRedemption({ pointsBalance: 1000, isOptimistic: true }),
      );

      act(() => result.current.input.setValue("500"));
      expect(result.current.form.isValid).toBe(false);
    });
  });

  describe("stepper helpers", () => {
    test("increment / decrement move by the adaptive step, clamped to [0, balance]", () => {
      const { result } = renderHook(() => usePointsRedemption({ pointsBalance: 1000 }));
      // balance 1000 -> step 100.

      act(() => result.current.input.increment());
      expect(result.current.input.value).toBe("100");

      act(() => result.current.input.decrement());
      expect(result.current.input.value).toBe(""); // 100 - 100 -> 0 -> empty

      act(() => result.current.input.setValue("950"));
      act(() => result.current.input.increment());
      expect(result.current.input.value).toBe("1000"); // 950 + 100 clamps to balance
    });

    test("setMax fills the full balance", () => {
      const { result } = renderHook(() => usePointsRedemption({ pointsBalance: 750 }));

      act(() => result.current.input.setMax());
      expect(result.current.input.value).toBe("750");
      expect(result.current.form.isValid).toBe(true);
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
      expect(result.current.input.step).toBe(expectedStep);
    });
  });

  describe("redeem", () => {
    test("submits the REDEEM action and surfaces redeemedPoints on success", () => {
      const { result, rerender } = renderHook(() =>
        usePointsRedemption({ pointsBalance: 1000, customerId: "gid://shopify/Customer/1" }),
      );

      act(() => result.current.input.setValue("300"));
      act(() => result.current.form.submit());

      expect(mock.submit).toHaveBeenCalledWith(
        { action: "RedeemPoints", points: 300, customerId: "gid://shopify/Customer/1" },
        ROUTE,
      );

      mock.fetcher.data = { success: true, points: 300 };
      act(() => rerender());

      expect(result.current.result.redeemedPoints).toBe(300);
      expect(result.current.result.error).toBe(null);
    });

    test("is not submittable with empty input", () => {
      const { result } = renderHook(() => usePointsRedemption({ pointsBalance: 100 }));

      // submit() guards only on isOptimistic, but callers gate on isValid; assert the value.
      expect(result.current.input.value).toBe("");
      expect(result.current.form.isValid).toBe(false);
    });
  });

  describe("undo", () => {
    test("submits the UNDO action and clears redeemed state", () => {
      const { result, rerender } = renderHook(() => usePointsRedemption({ pointsBalance: 1000 }));

      mock.fetcher.data = { success: true, points: 200 };
      act(() => rerender());
      expect(result.current.result.redeemedPoints).toBe(200);

      act(() => result.current.form.undo());
      expect(mock.submit).toHaveBeenCalledWith({ action: "UndoRedeem" }, ROUTE);

      // UNDO puts the fetcher in flight, then resolves to a null body — both clear the points.
      mock.fetcher.state = "submitting";
      act(() => rerender());
      expect(result.current.result.redeemedPoints).toBe(null);

      mock.fetcher.state = "idle";
      mock.fetcher.data = null;
      act(() => rerender());
      expect(result.current.result.redeemedPoints).toBe(null);
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

      expect(result.current.result.error).toEqual({
        code: "redemption_failed",
        message: "Coupon could not be created",
      });
      expect(result.current.result.redeemedPoints).toBe(null);
    });

    test("clears a prior error once a redeem succeeds", () => {
      const { result, rerender } = renderHook(() => usePointsRedemption({ pointsBalance: 1000 }));

      mock.fetcher.data = { success: false, points: 0, error: { message: "nope" } };
      act(() => rerender());
      expect(result.current.result.error).not.toBe(null);

      mock.fetcher.data = { success: true, points: 100 };
      act(() => rerender());
      expect(result.current.result.error).toBe(null);
      expect(result.current.result.redeemedPoints).toBe(100);
    });

    test("clears a previous error when a new submit starts", () => {
      const { result, rerender } = renderHook(() => usePointsRedemption({ pointsBalance: 1000 }));

      mock.fetcher.data = { success: false, points: 0, error: { message: "nope" } };
      act(() => rerender());
      expect(result.current.result.error).not.toBe(null);

      mock.fetcher.state = "submitting";
      act(() => rerender());
      expect(result.current.result.error).toBe(null);
    });
  });

  describe("isSubmitting", () => {
    test("reflects the fetcher submitting state", () => {
      mock.fetcher.state = "submitting";
      const { result } = renderHook(() => usePointsRedemption({ pointsBalance: 1000 }));
      expect(result.current.form.isSubmitting).toBe(true);
    });
  });

  describe("optimistic guard", () => {
    test("redeem() is a no-op while the cart is optimistic", () => {
      const { result } = renderHook(() =>
        usePointsRedemption({ pointsBalance: 1000, isOptimistic: true }),
      );

      act(() => result.current.input.setValue("100"));
      act(() => result.current.form.submit());

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

      act(() => result.current.input.setValue("800"));
      expect(result.current.form.isValid).toBe(true);

      act(() => result.current.form.submit());
      expect(mock.submit).toHaveBeenCalledWith(
        { action: "RedeemPoints", points: 800, customerId: "gid://shopify/Customer/42" },
        { method: "POST", action: "/custom/cart/points" },
      );
    });

    test("explicit params win over the provider", () => {
      const { result } = renderHook(() => usePointsRedemption({ pointsBalance: 50 }), {
        wrapper: wrapper({ customerLoyalty: account(800) }),
      });

      act(() => result.current.input.setValue("800"));
      // Clamped to the explicit balance of 50, not the provider's 800.
      expect(result.current.input.value).toBe("50");
    });
  });
});
