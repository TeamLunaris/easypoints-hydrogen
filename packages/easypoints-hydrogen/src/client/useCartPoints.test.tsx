// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import { EasyPointsProvider } from "./context";
import { useCartPoints } from "./hooks/useCartPoints";

import type { EasyPointsContext } from "./context";
import type { PointsCart } from "./hooks/useCartPoints";
import type { CalculatePointsResponse } from "../server/routes/cartPoints";
import type { CustomerLoyaltyMetafield } from "../types";
import type { ReactNode } from "react";

// A single mutable fetcher stands in for `useFetcher`. Tests drive it by mutating `data` and
// re-rendering, then assert on `submit`.
const mock = vi.hoisted(() => {
  const submit = vi.fn();
  const fetcher: {
    data: CalculatePointsResponse | undefined;
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

const ROUTE = { method: "post", action: "/api/cart/points" };

const settledCart = (...ids: string[]): PointsCart => ({
  isOptimistic: false,
  lines: { nodes: ids.map((id) => ({ id })) },
});

// Only `.balance` is read by the hook; cast keeps the fixture small.
const account = (balance: number) => ({ balance }) as CustomerLoyaltyMetafield;

const wrapper =
  (value: EasyPointsContext) =>
  ({ children }: { children: ReactNode }) => (
    <EasyPointsProvider {...value}>{children}</EasyPointsProvider>
  );

describe("useCartPoints", () => {
  test("submits CALCULATE_POINTS with the balance once the cart settles", () => {
    renderHook(() => useCartPoints(settledCart("l1"), account(500)));
    expect(mock.submit).toHaveBeenCalledWith(
      { action: "CalculatePoints", pointsBalance: 500 },
      ROUTE,
    );
  });

  test("uses a zero balance when the customer is signed out", () => {
    renderHook(() => useCartPoints(settledCart("l1"), null));
    expect(mock.submit).toHaveBeenCalledWith(
      { action: "CalculatePoints", pointsBalance: 0 },
      ROUTE,
    );
  });

  test("does not submit while the cart is optimistic", () => {
    renderHook(() => useCartPoints({ ...settledCart("l1"), isOptimistic: true }, account(500)));
    expect(mock.submit).not.toHaveBeenCalled();
  });

  test("does not submit when there is no cart", () => {
    renderHook(() => useCartPoints(null, account(500)));
    expect(mock.submit).not.toHaveBeenCalled();
  });

  test("maps fetcher results and sums numeric points, ignoring null", () => {
    const { result, rerender } = renderHook(() =>
      useCartPoints(settledCart("l1", "l2", "l3"), account(500)),
    );

    mock.fetcher.data = { pointsMap: { l1: 100, l2: 50, l3: null } };
    act(() => rerender());

    expect(result.current.pointsMap).toEqual({ l1: 100, l2: 50, l3: null });
    expect(result.current.totalPoints).toBe(150);
  });

  test("clears the map once lineFilter excludes every line", () => {
    let include = true;
    const { result, rerender } = renderHook(() =>
      useCartPoints(settledCart("l1"), account(500), { lineFilter: () => include }),
    );

    mock.fetcher.data = { pointsMap: { l1: 100 } };
    act(() => rerender());
    expect(result.current.pointsMap).toEqual({ l1: 100 });

    // Eligible count transitions 1 -> 0, which clears the accumulated map.
    include = false;
    act(() => rerender());
    expect(result.current.pointsMap).toEqual({});
    expect(result.current.totalPoints).toBe(0);
  });

  test("re-submits when the cart lines change", () => {
    let cart = settledCart("l1");
    const { rerender } = renderHook(() => useCartPoints(cart, account(500)));
    expect(mock.submit).toHaveBeenCalledTimes(1);

    cart = settledCart("l1", "l2");
    act(() => rerender());
    expect(mock.submit).toHaveBeenCalledTimes(2);
  });

  test("re-submits when the balance changes", () => {
    let balance = 500;
    const { rerender } = renderHook(() => useCartPoints(settledCart("l1"), account(balance)));
    expect(mock.submit).toHaveBeenCalledTimes(1);

    balance = 600;
    act(() => rerender());
    expect(mock.submit).toHaveBeenCalledTimes(2);
    expect(mock.submit).toHaveBeenLastCalledWith(
      { action: "CalculatePoints", pointsBalance: 600 },
      ROUTE,
    );
  });

  test("reflects the latest fetcher data across refetches", () => {
    const { result, rerender } = renderHook(() =>
      useCartPoints(settledCart("l1", "l2"), account(500)),
    );

    mock.fetcher.data = { pointsMap: { l1: 100, l2: 50 } };
    act(() => rerender());
    expect(result.current.totalPoints).toBe(150);

    mock.fetcher.data = { pointsMap: { l1: 200, l2: 50 } };
    act(() => rerender());
    expect(result.current.pointsMap).toEqual({ l1: 200, l2: 50 });
    expect(result.current.totalPoints).toBe(250);
  });

  test("clears the map when the cart has no lines", () => {
    let cart = settledCart("l1");
    const { result, rerender } = renderHook(() => useCartPoints(cart, account(500)));

    mock.fetcher.data = { pointsMap: { l1: 100 } };
    act(() => rerender());
    expect(result.current.pointsMap).toEqual({ l1: 100 });

    cart = { isOptimistic: false, lines: { nodes: [] } };
    act(() => rerender());
    expect(result.current.pointsMap).toEqual({});
    expect(result.current.totalPoints).toBe(0);
  });

  test("submits to an explicit route override", () => {
    renderHook(() => useCartPoints(settledCart("l1"), account(500), { route: "/custom/points" }));
    expect(mock.submit).toHaveBeenCalledWith(
      { action: "CalculatePoints", pointsBalance: 500 },
      { method: "post", action: "/custom/points" },
    );
  });

  test("falls back to the provider route", () => {
    renderHook(() => useCartPoints(settledCart("l1"), account(500)), {
      wrapper: wrapper({ route: "/provider/points" }),
    });
    expect(mock.submit).toHaveBeenCalledWith(
      { action: "CalculatePoints", pointsBalance: 500 },
      { method: "post", action: "/provider/points" },
    );
  });
});
