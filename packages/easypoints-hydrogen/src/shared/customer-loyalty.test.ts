import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import { parseCustomerLoyalty } from "./customer-loyalty";

const CUSTOMER_ID = "gid://shopify/Customer/1";

/** A complete (snake_case) metafield value as the API serializes it into the metafield. */
const METAFIELD_VALUE = JSON.stringify({
  balance: 100,
  currency_value: 100,
  tier: "Gold",
  tier_uid: "abc",
  point_value: 1,
  expiration_date: null,
  tier_name: "Gold",
  percentage: 1,
  include_tax: false,
  tier_maintenance_data: {
    maintenance_data: {
      amount: "¥0",
      currency: "JPY",
      raw_amount: 0,
      deadline: null,
      spent_requirement: { amount: "¥0", currency: "JPY", raw_amount: 0 },
    },
    advancement_data: {
      amount: "¥0",
      currency: "JPY",
      raw_amount: 0,
      deadline: null,
      spent_requirement: { amount: "¥0", currency: "JPY", raw_amount: 0 },
      tier_uid: "abc",
      tier_name: "Gold",
      tiers: [],
    },
  },
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseCustomerLoyalty", () => {
  test("parses, camelCases, and injects the customerId", () => {
    const result = parseCustomerLoyalty(METAFIELD_VALUE, CUSTOMER_ID);

    expect(result).toMatchObject({
      customerId: CUSTOMER_ID,
      balance: 100,
      currencyValue: 100,
      tierUid: "abc",
      includeTax: false,
      tierMaintenanceData: {
        maintenanceData: { rawAmount: 0, spentRequirement: { rawAmount: 0 } },
      },
    });
  });

  test.each([
    ["null", null],
    ["undefined", undefined],
    ["empty string", ""],
  ])("returns null when the value is %s", (_label, value) => {
    expect(parseCustomerLoyalty(value, CUSTOMER_ID)).toBe(null);
  });

  test("returns null and logs when the value is not valid JSON", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(parseCustomerLoyalty("not json", CUSTOMER_ID)).toBe(null);
    expect(errorSpy).toHaveBeenCalled();
  });

  test("returns null and logs when the parsed shape is incomplete", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const partial = JSON.stringify({ balance: 100, tier_uid: "abc" });

    expect(parseCustomerLoyalty(partial, CUSTOMER_ID)).toBe(null);
    expect(errorSpy).toHaveBeenCalled();
  });
});
