import { expect, test } from "vite-plus/test";

import { keysToCamel } from "./case";

test("converts a single snake_case key to camelCase", () => {
  expect(keysToCamel({ currency_value: 1 })).toEqual({ currencyValue: 1 });
});

test("converts a single kebab-case key to camelCase", () => {
  expect(keysToCamel({ "point-value": 2 })).toEqual({ pointValue: 2 });
});

test("converts nested objects recursively", () => {
  expect(
    keysToCamel({
      tier_maintenance_data: {
        advancement_data: { tier_uid: "abc", tier_name: "Gold" },
      },
    }),
  ).toEqual({
    tierMaintenanceData: {
      advancementData: { tierUid: "abc", tierName: "Gold" },
    },
  });
});

test("converts arrays of objects element-wise", () => {
  expect(keysToCamel([{ point_value: 1 }, { point_value: 2 }])).toEqual([
    { pointValue: 1 },
    { pointValue: 2 },
  ]);
});

test("leaves already-camelCase keys unchanged", () => {
  expect(keysToCamel({ pointValue: 3 })).toEqual({ pointValue: 3 });
});

test("passes non-object scalars through untouched", () => {
  expect(keysToCamel(42)).toBe(42);
  expect(keysToCamel("foo_bar")).toBe("foo_bar");
  expect(keysToCamel(null)).toBe(null);
  expect(keysToCamel(true)).toBe(true);
});
