// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, test } from "vite-plus/test";

import { EasyPointsProvider } from "./context";
import { useCustomerLoyalty } from "./hooks/useCustomerLoyalty";

import type { EasyPointsContext } from "./context";
import type { CustomerLoyaltyMetafield } from "../types";
import type { ReactNode } from "react";

const loyalty = (overrides: Partial<CustomerLoyaltyMetafield> = {}): CustomerLoyaltyMetafield => ({
  customerId: "gid://shopify/Customer/1",
  balance: 1000,
  currencyValue: 100,
  tier: "Silver",
  tierUid: "tier-current",
  pointValue: 1,
  expirationDate: null,
  tierName: "Silver",
  percentage: 1,
  includeTax: false,
  tierMaintenanceData: {
    maintenanceData: {
      amount: null,
      currency: "JPY",
      rawAmount: null,
      deadline: null,
      spentRequirement: { amount: null, currency: "JPY", rawAmount: null },
    },
    advancementData: {
      amount: null,
      currency: "JPY",
      rawAmount: null,
      deadline: null,
      spentRequirement: { amount: null, currency: "JPY", rawAmount: null },
      tierUid: "",
      tierName: null,
      tiers: [],
    },
  },
  ...overrides,
});

const wrapper =
  (value: EasyPointsContext) =>
  ({ children }: { children: ReactNode }) => (
    <EasyPointsProvider {...value}>{children}</EasyPointsProvider>
  );

describe("useCustomerLoyalty", () => {
  test("returns null with no argument and no provider", () => {
    const { result } = renderHook(() => useCustomerLoyalty());
    expect(result.current).toBe(null);
  });

  test("returns the explicit argument when one is passed", () => {
    const explicit = loyalty({ balance: 250 });
    const { result } = renderHook(() => useCustomerLoyalty(explicit));
    expect(result.current).toBe(explicit);
  });

  test("falls back to the provider when the argument is undefined", () => {
    const provided = loyalty({ balance: 777 });
    const { result } = renderHook(() => useCustomerLoyalty(), {
      wrapper: wrapper({ customerLoyalty: provided }),
    });
    expect(result.current).toBe(provided);
  });

  test("prefers the explicit argument over the provider", () => {
    const explicit = loyalty({ balance: 100 });
    const provided = loyalty({ balance: 999 });
    const { result } = renderHook(() => useCustomerLoyalty(explicit), {
      wrapper: wrapper({ customerLoyalty: provided }),
    });
    expect(result.current).toBe(explicit);
  });

  test("explicit null forces a no-loyalty result regardless of the provider", () => {
    const provided = loyalty({ balance: 999 });
    const { result } = renderHook(() => useCustomerLoyalty(null), {
      wrapper: wrapper({ customerLoyalty: provided }),
    });
    expect(result.current).toBe(null);
  });
});
