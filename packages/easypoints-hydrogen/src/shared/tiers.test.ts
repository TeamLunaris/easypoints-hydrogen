import { describe, expect, test } from "vite-plus/test";

import { getCurrentTier, getMaintenanceTier, getNextTier, getProgressTier } from "./tiers";

import { loyaltyCustomer, tier } from "../test-support/fixtures/loyalty";

import type { LoyaltyCustomer } from "../types";

// --- tier scenarios ---------------------------------------------------------

const standardTiers = [tier("tier-current", "Silver", -100), tier("tier-next", "Gold", 8000)];

// Mid-maintenance: still owes spend to hold the current tier.
const maintenanceCustomer = loyaltyCustomer({ maintenanceRaw: 5000, tiers: standardTiers });

// Met maintenance, can still advance to a higher tier.
const nextTierCustomer = loyaltyCustomer({ maintenanceRaw: 0, tiers: standardTiers });

// Met maintenance with no remaining tier to advance to.
const highestTierCustomer = loyaltyCustomer({
  maintenanceRaw: 0,
  tiers: [tier("tier-current", "Silver", -100), tier("tier-top", "Platinum", -50)],
});

const noLoyaltyCustomer: LoyaltyCustomer = { loyalty: null };

describe("getCurrentTier", () => {
  test("resolves the customer's current tier object", () => {
    expect(getCurrentTier(maintenanceCustomer)?.uid).toBe("tier-current");
    expect(getCurrentTier(maintenanceCustomer)?.name).toBe("Silver");
  });

  test("matches even when the active uid is reformatted in state", () => {
    // tierUid can come back dash-stripped / recased; both sides are normalized before matching.
    const customer = loyaltyCustomer({ tierUid: "TierCurrent", tiers: standardTiers });
    expect(getCurrentTier(customer)?.uid).toBe("tier-current");
  });

  test("returns null without loyalty", () => {
    expect(getCurrentTier(noLoyaltyCustomer)).toBe(null);
  });
});

describe("getProgressTier", () => {
  test("yields MAINTENANCE_TIER when spend is still owed", () => {
    const progress = getProgressTier(maintenanceCustomer);
    expect(progress?.dataType).toBe("MAINTENANCE_TIER");
    expect(progress?.name).toBe("Silver");
    expect(progress?.spend.raw).toBe(5000);
  });

  test("yields NEXT_TIER when advancement is available", () => {
    const progress = getProgressTier(nextTierCustomer);
    expect(progress?.dataType).toBe("NEXT_TIER");
    expect(progress?.name).toBe("Gold");
    expect(progress?.uid).toBe("tier-next");
  });

  test("yields HIGHEST_TIER_NEXT_CYCLE when no further tier exists", () => {
    const progress = getProgressTier(highestTierCustomer);
    expect(progress?.dataType).toBe("HIGHEST_TIER_NEXT_CYCLE");
  });

  test("returns null without loyalty", () => {
    expect(getProgressTier(noLoyaltyCustomer)).toBe(null);
  });
});

describe("getNextTier", () => {
  test("returns the next advancement target", () => {
    const next = getNextTier(nextTierCustomer);
    expect(next?.uid).toBe("tier-next");
    expect(next?.name).toBe("Gold");
    expect(next?.requirement.raw).toBe(8000);
  });

  test("returns null when every tier is already achieved", () => {
    expect(getNextTier(highestTierCustomer)).toBe(null);
  });
});

describe("getMaintenanceTier", () => {
  test("returns the current tier maintenance target", () => {
    const maintenance = getMaintenanceTier(maintenanceCustomer);
    expect(maintenance?.uid).toBe("tier-current");
    expect(maintenance?.name).toBe("Silver");
    expect(maintenance?.deadline).toBe("2026-12-31");
    expect(maintenance?.spend.raw).toBe(5000);
  });

  test("returns null without loyalty", () => {
    expect(getMaintenanceTier(noLoyaltyCustomer)).toBe(null);
  });
});
