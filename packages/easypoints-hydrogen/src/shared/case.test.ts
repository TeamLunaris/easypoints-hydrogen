import { describe, expect, test } from "vite-plus/test";

import { keysToCamel } from "./case";

describe("keysToCamel", () => {
  test.each([
    ["single snake_case key", { currency_value: 1 }, { currencyValue: 1 }],
    ["single kebab-case key", { "point-value": 2 }, { pointValue: 2 }],
    [
      "nested objects recursively",
      { tier_maintenance_data: { advancement_data: { tier_uid: "abc", tier_name: "Gold" } } },
      { tierMaintenanceData: { advancementData: { tierUid: "abc", tierName: "Gold" } } },
    ],
    [
      "arrays of objects element-wise",
      [{ point_value: 1 }, { point_value: 2 }],
      [{ pointValue: 1 }, { pointValue: 2 }],
    ],
    ["already-camelCase keys unchanged", { pointValue: 3 }, { pointValue: 3 }],
  ])("converts %s", (_label, input, expected) => {
    expect(keysToCamel(input)).toEqual(expected);
  });

  test.each([
    ["number", 42],
    ["snake_case string", "foo_bar"],
    ["null", null],
    ["boolean", true],
  ])("passes the %s scalar through untouched", (_label, value) => {
    expect(keysToCamel(value)).toBe(value);
  });
});
