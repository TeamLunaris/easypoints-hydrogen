// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, test } from "vite-plus/test";

import { BASE_TIER_PROGRESS_PERCENTAGE, useTierProgress } from "./hooks/useTierProgress";

import { loyaltyMetafield, tier } from "../test-support/fixtures/loyalty";
import { createWrapper } from "../test-support/react";

const standardTiers = [tier("tier-current", "Silver", -100), tier("tier-next", "Gold", 8000)];

// Mid-maintenance: still owes 5000 spend to hold the current tier.
const maintenanceLoyalty = loyaltyMetafield({ maintenanceRaw: 5000, tiers: standardTiers });

// Met maintenance, can still advance to a higher tier.
const nextTierLoyalty = loyaltyMetafield({ maintenanceRaw: 0, tiers: standardTiers });

describe("useTierProgress", () => {
  test("returns an empty, floored result for null loyalty", () => {
    const { result } = renderHook(() => useTierProgress(null));
    expect(result.current).toEqual({
      currentTier: null,
      progress: null,
      percentage: BASE_TIER_PROGRESS_PERCENTAGE,
      dataType: null,
    });
  });

  test("explicit null forces an empty result even with a provider", () => {
    const { result } = renderHook(() => useTierProgress(null), {
      wrapper: createWrapper({ customerLoyalty: maintenanceLoyalty }),
    });
    expect(result.current.dataType).toBe(null);
    expect(result.current.currentTier).toBe(null);
  });

  test("derives the current tier and maintenance progression", () => {
    const { result } = renderHook(() => useTierProgress(maintenanceLoyalty));
    expect(result.current.currentTier?.uid).toBe("tier-current");
    expect(result.current.dataType).toBe("MAINTENANCE_TIER");
  });

  test("falls back to the provider's customerLoyalty", () => {
    const { result } = renderHook(() => useTierProgress(), {
      wrapper: createWrapper({ customerLoyalty: maintenanceLoyalty }),
    });
    expect(result.current.dataType).toBe("MAINTENANCE_TIER");
    expect(result.current.currentTier?.uid).toBe("tier-current");
  });

  test("floors the percentage at the base when there is no spend yet", () => {
    const { result } = renderHook(() => useTierProgress(maintenanceLoyalty, 0));
    expect(result.current.percentage).toBe(BASE_TIER_PROGRESS_PERCENTAGE);
  });

  test("computes the percentage from subtotal vs. requirement", () => {
    // requirement.raw = 5000, subtotal = 2500 -> 50%.
    const { result } = renderHook(() => useTierProgress(maintenanceLoyalty, 2500));
    expect(result.current.percentage).toBe(50);
  });

  test("caps the percentage at 100", () => {
    // subtotal 20000 overshoots the 8000 requirement -> capped at 100.
    const { result } = renderHook(() => useTierProgress(nextTierLoyalty, 20000));
    expect(result.current.percentage).toBe(100);
    expect(result.current.dataType).toBe("HIGHEST_TIER_NEXT_CYCLE");
  });
});
