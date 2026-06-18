import { describe, expect, test } from "vite-plus/test";

import {
  getCurrentTier,
  getMaintenanceTier,
  getNextTier,
  getProgressTier,
  getTierRule,
  sortTierRules,
} from "./tiers";

import type {
  AmountCurrency,
  CustomerLoyaltyMetafield,
  LoyaltyCustomer,
  Tier,
  TierRule,
} from "../types";

// --- fixture helpers --------------------------------------------------------

const amount = (raw: number | null): AmountCurrency => ({
  amount: raw === null ? null : String(raw),
  currency: "JPY",
  rawAmount: raw,
});

const tier = (uid: string, name: string, raw: number, ratio = 0.01): Tier => ({
  ...amount(raw),
  uid,
  name,
  ratio,
  spentRequirement: amount(raw),
});

const makeCustomer = (
  loyalty: Partial<CustomerLoyaltyMetafield> & {
    maintenanceRaw: number | null;
    tiers: Tier[];
  },
): LoyaltyCustomer => {
  const { maintenanceRaw, tiers, ...rest } = loyalty;

  return {
    loyalty: {
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
          ...amount(maintenanceRaw),
          deadline: "2026-12-31",
          spentRequirement: amount(maintenanceRaw),
        },
        advancementData: {
          ...amount(0),
          deadline: "2027-06-30",
          spentRequirement: amount(0),
          tierUid: "tier-next",
          tierName: "Gold",
          tiers,
        },
      },
      ...rest,
    },
  };
};

// A customer mid-maintenance: still owes spend to hold the current tier.
const maintenanceCustomer = makeCustomer({
  maintenanceRaw: 5000,
  tiers: [tier("tier-current", "Silver", -100), tier("tier-next", "Gold", 8000)],
});

// A customer who has met maintenance and can still advance to a higher tier.
const nextTierCustomer = makeCustomer({
  maintenanceRaw: 0,
  tiers: [tier("tier-current", "Silver", -100), tier("tier-next", "Gold", 8000)],
});

// A customer who has met maintenance with no remaining tier to advance to.
const highestTierCustomer = makeCustomer({
  maintenanceRaw: 0,
  tiers: [tier("tier-current", "Silver", -100), tier("tier-top", "Platinum", -50)],
});

const noLoyaltyCustomer: LoyaltyCustomer = { loyalty: null };

describe("getCurrentTier", () => {
  test("resolves the customer's current tier object", () => {
    expect(getCurrentTier(maintenanceCustomer)?.uid).toBe("tier-current");
    expect(getCurrentTier(maintenanceCustomer)?.name).toBe("Silver");
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

// --- sortTierRules / getTierRule --------------------------------------------

const tierRules: Record<string, TierRule> = {
  "tier-gold": {
    currencyValue: 100,
    percentage: 2,
    pointValue: 1,
    currencySpentRequirement: 8000,
    freeShipping: true,
    name: "Gold",
  },
  "tier-silver": {
    currencyValue: 100,
    percentage: 1,
    pointValue: 1,
    currencySpentRequirement: 1000,
    freeShipping: false,
    name: "Silver",
  },
};

describe("sortTierRules", () => {
  test("orders rules by spend requirement ascending", () => {
    expect(sortTierRules(tierRules).map(([key]) => key)).toEqual(["tier-silver", "tier-gold"]);
  });
});

describe("getTierRule", () => {
  test("resolves level and rule by uid (uid normalization)", () => {
    // uid keys are matched after stripping dashes / lowercasing.
    const result = getTierRule(tierRules, { uid: "TIER-GOLD" });
    expect(result.level).toBe(2);
    expect(result.tierRule?.name).toBe("Gold");
  });

  test("returns level 0 for an unknown uid", () => {
    const result = getTierRule(tierRules, { uid: "missing" });
    expect(result).toEqual({ level: 0, tierRule: null });
  });
});
