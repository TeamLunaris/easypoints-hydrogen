// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, test, vi } from "vite-plus/test";

import { useCartPoints } from "./hooks/useCartPoints";

import { createWrapper, setupFetcherMock } from "../test-support/react";

import type { PointsCart } from "./hooks/useCartPoints";
import type { CalculatePointsResponse } from "../server/routes/cartPoints";
import type { FetcherMock } from "../test-support/react";

// A single mutable fetcher stands in for `useFetcher`. Tests drive it by mutating `data` and
// re-rendering, then assert on `submit`. Hoisted so the `vi.mock` factory can close over it.
const mock = vi.hoisted((): FetcherMock<CalculatePointsResponse> => {
  const submit = vi.fn();

  return {
    submit,
    fetcher: { data: undefined, state: "idle", submit },
  };
});

vi.mock("react-router", () => ({
  useFetcher: () => mock.fetcher,
}));

setupFetcherMock(mock);

const ROUTE = { method: "POST", action: "/api/cart/points" };

const settledCart = (...ids: string[]): PointsCart => ({
  isOptimistic: false,
  lines: { nodes: ids.map((id) => ({ id })) },
});

describe("useCartPoints", () => {
  test("submits CALCULATE_POINTS once the cart settles", () => {
    renderHook(() => useCartPoints(settledCart("l1")));
    expect(mock.submit).toHaveBeenCalledWith({ action: "CalculatePoints" }, ROUTE);
  });

  test("does not submit while the cart is optimistic", () => {
    renderHook(() => useCartPoints({ ...settledCart("l1"), isOptimistic: true }));
    expect(mock.submit).not.toHaveBeenCalled();
  });

  test("does not submit when there is no cart", () => {
    renderHook(() => useCartPoints(null));
    expect(mock.submit).not.toHaveBeenCalled();
  });

  test("maps fetcher results and sums numeric points, ignoring null", () => {
    const { result, rerender } = renderHook(() => useCartPoints(settledCart("l1", "l2", "l3")));

    mock.fetcher.data = { pointsMap: { l1: 100, l2: 50, l3: null } };
    act(() => rerender());

    expect(result.current.pointsMap).toEqual({ l1: 100, l2: 50, l3: null });
    expect(result.current.totalPoints).toBe(150);
  });

  test("re-submits when the cart lines change", () => {
    let cart = settledCart("l1");
    const { rerender } = renderHook(() => useCartPoints(cart));
    expect(mock.submit).toHaveBeenCalledTimes(1);

    cart = settledCart("l1", "l2");
    act(() => rerender());
    expect(mock.submit).toHaveBeenCalledTimes(2);
  });

  test("does not re-submit when revalidation re-renders with the same (reordered) lines", () => {
    // A fetcher POST revalidates page loaders, re-rendering this hook with a fresh cart object
    // whose lines may come back in a different order. Same content must not re-fetch, else the
    // fetch ⇆ revalidate cycle loops forever.
    let cart = settledCart("l1", "l2");
    const { rerender } = renderHook(() => useCartPoints(cart));
    expect(mock.submit).toHaveBeenCalledTimes(1);

    cart = settledCart("l2", "l1");
    act(() => rerender());
    expect(mock.submit).toHaveBeenCalledTimes(1);
  });

  test("reflects the latest fetcher data across refetches", () => {
    const { result, rerender } = renderHook(() => useCartPoints(settledCart("l1", "l2")));

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
    const { result, rerender } = renderHook(() => useCartPoints(cart));

    mock.fetcher.data = { pointsMap: { l1: 100 } };
    act(() => rerender());
    expect(result.current.pointsMap).toEqual({ l1: 100 });

    cart = { isOptimistic: false, lines: { nodes: [] } };
    act(() => rerender());
    expect(result.current.pointsMap).toEqual({});
    expect(result.current.totalPoints).toBe(0);
  });

  test("submits to an explicit route override", () => {
    renderHook(() => useCartPoints(settledCart("l1"), { route: "/custom/points" }));
    expect(mock.submit).toHaveBeenCalledWith(
      { action: "CalculatePoints" },
      { method: "POST", action: "/custom/points" },
    );
  });

  test("falls back to the provider route", () => {
    renderHook(() => useCartPoints(settledCart("l1")), {
      wrapper: createWrapper({ route: "/provider/points" }),
    });
    expect(mock.submit).toHaveBeenCalledWith(
      { action: "CalculatePoints" },
      { method: "POST", action: "/provider/points" },
    );
  });
});
