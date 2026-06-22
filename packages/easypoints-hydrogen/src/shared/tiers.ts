import type { LoyaltyCustomer, Tier, TierMaintenance, TierRule } from "../types";

export interface RawAmount {
  currency: string;
  raw: number | null;
}

export interface TierProgress {
  requirement: RawAmount;
  spend: RawAmount;
}

/**
 * Normalizes a tier UID for comparison by stripping dashes and lowercasing.
 * Tier keys can be reformatted as they pass through state, so both sides of a
 * comparison must be normalized before matching.
 */
const transformUid = (v: string) => v.replaceAll("-", "").toLowerCase();

/**
 * Sorts a map of tier rules into ascending order by spend requirement.
 *
 * @returns The tier rules as `[uid, rule]` entries, lowest requirement first.
 */
export const sortTierRules = (tierRules: Record<string, TierRule>) =>
  Object.entries(tierRules).sort(
    ([, a], [, b]) => a.currencySpentRequirement - b.currencySpentRequirement,
  );

/**
 * Finds the position of a tier within a sorted list of tier rules.
 *
 * @returns The index of the matching tier, or -1 if no tier matches `uid`.
 */
export const findTierIndex = (sortedTierRules: [string, TierRule][], uid: string) =>
  sortedTierRules.findIndex(
    ([key, _tierRule]) =>
      // somehow the uid tier keys get transformed within the state...
      transformUid(key) === transformUid(uid),
  );

/**
 * Resolves a tier's 1-based level and rule from a map of tier rules.
 *
 * @returns `{ level, tierRule }` where `level` is the 1-based rank of the tier
 *   (lowest requirement is 1), or `{ level: 0, tierRule: null }` when `uid` is
 *   not found.
 */
export const getTierRule = (tierRules: Record<string, TierRule>, { uid }: { uid: string }) => {
  const sortedTierRules = sortTierRules(tierRules);

  const idx = findTierIndex(sortedTierRules, uid);

  if (idx !== -1) {
    const [, tierRule] = sortedTierRules[idx];

    return { level: idx + 1, tierRule };
  }

  return { level: 0, tierRule: null };
};

/**
 * Reshapes a tier into a progress view of requirement vs. accumulated spend.
 *
 * @param subtotal - Pending spend (e.g. a cart total) to factor into the
 *   remaining amount; subtracted from the tier's raw amount when present.
 * @returns The tier's `requirement` and `spend` as currency/raw amount pairs.
 */
const transformTierData = (tier: Tier | TierMaintenance, subtotal = 0): TierProgress => {
  return {
    requirement: {
      currency: tier.spentRequirement?.currency,
      raw: tier.spentRequirement?.rawAmount,
    },
    spend: {
      currency: tier.currency,
      raw: tier.rawAmount !== null ? tier.rawAmount - subtotal : null,
    },
  };
};

/**
 * Determines the next tier a customer is progressing toward.
 *
 * Skips over any tiers already covered by `subtotal` and accounts for their
 * combined amount so the returned progress reflects spend toward the next
 * unreached tier.
 *
 * @param subtotal - Pending spend (e.g. a cart total) applied before evaluation.
 * @returns The next tier with its deadline, name, ratio, uid and progress data,
 *   or `null` when there is no further tier to reach (or loyalty is absent).
 */
export const getNextTier = (customer: LoyaltyCustomer, subtotal = 0) => {
  if (customer.loyalty === null) return null;

  const { advancementData: advancement } = customer.loyalty.tierMaintenanceData;

  if (!advancement || advancement.tiers.length === 0) {
    return null;
  }

  const nextTier = advancement.tiers.find(
    (tier) => tier.rawAmount && tier.rawAmount - subtotal > 0,
  );

  if (!nextTier) {
    return null;
  }

  // calculate the total of tiers we've skipped
  const skippedAmount: number = advancement.tiers.reduce((acc: number, t: Tier): number => {
    if (t.rawAmount && t.rawAmount - subtotal < 0) {
      return acc + t.rawAmount;
    }

    return acc;
  }, 0);

  return {
    deadline: advancement.deadline,
    name: nextTier.name,
    ratio: nextTier.ratio,
    uid: nextTier.uid,
    ...transformTierData(nextTier, subtotal - skippedAmount),
  };
};

/**
 * Builds the progress view for the tier a customer must maintain this cycle.
 *
 * @param subtotal - Pending spend (e.g. a cart total) applied before evaluation.
 * @returns The current tier the customer has to maintain, with its deadline,
 *   name, uid and progress data, or `null` when loyalty is absent.
 */
export const getMaintenanceTier = (customer: LoyaltyCustomer, subtotal = 0) => {
  if (customer.loyalty === null) return null;

  const { maintenanceData: maintenance } = customer.loyalty.tierMaintenanceData;

  return {
    deadline: maintenance.deadline,
    name: customer.loyalty.tier,
    uid: customer.loyalty.tierUid,
    ...transformTierData(maintenance, subtotal),
  };
};

type TierProgressStates = "MAINTENANCE_TIER" | "HIGHEST_TIER_NEXT_CYCLE" | "NEXT_TIER";

/**
 * Selects the single tier to surface in progress UI, resolving which of the
 * three progression states applies:
 * - `MAINTENANCE_TIER` — still working to retain the current tier.
 * - `NEXT_TIER` — advancing toward a reachable higher tier.
 * - `HIGHEST_TIER_NEXT_CYCLE` — on track for the top tier next cycle (also the
 *   fallback when advancement data is empty/stale).
 *
 * @param subtotal - Pending spend (e.g. a cart total) applied before evaluation.
 * @returns The chosen tier tagged with its `dataType` and progress data, or
 *   `null` when loyalty is absent.
 */
export const getProgressTier = (customer: LoyaltyCustomer, subtotal = 0) => {
  const maintenanceTier = getMaintenanceTier(customer, subtotal);

  if (maintenanceTier === null || customer.loyalty === null) return null;

  if (maintenanceTier.spend.raw !== null && maintenanceTier.spend.raw > 0) {
    // we're in maintenance
    return {
      dataType: "MAINTENANCE_TIER" as TierProgressStates,
      ratio: customer.loyalty.pointValue / customer.loyalty.currencyValue,
      ...maintenanceTier,
    };
  }

  const nextTier = getNextTier(customer, subtotal);
  if (!nextTier) {
    // will achieve the highest tier next cycle
    const { advancementData: advancement } = customer.loyalty.tierMaintenanceData;
    const tier = advancement.tiers[advancement.tiers.length - 1];

    // advancement is empty/out of bounds so we'll just use our maintenance tier
    // this can happen during stale sessions when just having enabled the tier system.
    if (!tier) {
      return {
        dataType: "HIGHEST_TIER_NEXT_CYCLE" as TierProgressStates,
        ratio: customer.loyalty.pointValue / customer.loyalty.currencyValue,
        ...maintenanceTier,
      };
    }

    return {
      dataType: "HIGHEST_TIER_NEXT_CYCLE" as TierProgressStates,
      deadline: advancement.deadline,
      name: tier.name,
      ratio: tier.ratio,
      uid: tier.uid,
      ...transformTierData(tier),
    };
  }

  return {
    dataType: "NEXT_TIER" as TierProgressStates,
    ...nextTier,
  };
};

/**
 * Looks up the customer's current tier within their advancement tier list.
 *
 * @returns The {@link Tier} matching the customer's active tier uid, or `null`
 *   when loyalty is absent or no tier matches.
 */
export function getCurrentTier(customer: LoyaltyCustomer) {
  const loyalty = customer.loyalty;

  if (loyalty === null) return null;

  const tiers = loyalty.tierMaintenanceData.advancementData.tiers;

  return tiers.find((tier) => tier.uid === customer.loyalty?.tierUid) || null;
}
