// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, test } from "vite-plus/test";

import { useCustomerLoyalty } from "./hooks/useCustomerLoyalty";

import { loyaltyMetafield } from "../test-support/fixtures/loyalty";
import { createWrapper } from "../test-support/react";

describe("useCustomerLoyalty", () => {
  test("returns null with no argument and no provider", () => {
    const { result } = renderHook(() => useCustomerLoyalty());
    expect(result.current).toBe(null);
  });

  test("returns the explicit argument when one is passed", () => {
    const explicit = loyaltyMetafield({ balance: 250 });
    const { result } = renderHook(() => useCustomerLoyalty(explicit));
    expect(result.current).toBe(explicit);
  });

  test("falls back to the provider when the argument is undefined", () => {
    const provided = loyaltyMetafield({ balance: 777 });
    const { result } = renderHook(() => useCustomerLoyalty(), {
      wrapper: createWrapper({ customerLoyalty: provided }),
    });
    expect(result.current).toBe(provided);
  });

  test("prefers the explicit argument over the provider", () => {
    const explicit = loyaltyMetafield({ balance: 100 });
    const provided = loyaltyMetafield({ balance: 999 });
    const { result } = renderHook(() => useCustomerLoyalty(explicit), {
      wrapper: createWrapper({ customerLoyalty: provided }),
    });
    expect(result.current).toBe(explicit);
  });

  test("explicit null forces a no-loyalty result regardless of the provider", () => {
    const provided = loyaltyMetafield({ balance: 999 });
    const { result } = renderHook(() => useCustomerLoyalty(null), {
      wrapper: createWrapper({ customerLoyalty: provided }),
    });
    expect(result.current).toBe(null);
  });
});
