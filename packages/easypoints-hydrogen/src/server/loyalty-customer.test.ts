import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import { ContextError } from "./errors";
import { queryCustomerLoyalty } from "./loyalty-customer";

import type { Context } from "./loyalty";

type QueryResult = { data?: unknown; errors?: { message: string }[] };

/** Builds a fake loyalty `Context` whose `customerAccount` only implements what the query uses. */
function makeContext(account: {
  isLoggedIn?: () => Promise<boolean>;
  query?: () => Promise<QueryResult>;
}): Context {
  return {
    customerAccount: {
      isLoggedIn: account.isLoggedIn ?? (async () => true),
      query: account.query ?? (async () => ({ data: { customer: null } })),
    },
    storefront: {},
  } as unknown as Context;
}

/** A valid (snake_case) metafield value as the API returns it. */
const METAFIELD_VALUE = JSON.stringify({
  balance: 100,
  currency_value: 100,
  tier_uid: "abc",
  point_value: 1,
});

const loggedInWith = (loyalty: { value: string | null } | null) =>
  makeContext({
    isLoggedIn: async () => true,
    query: async () => ({ data: { customer: { id: "gid://shopify/Customer/1", loyalty } } }),
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("queryCustomerLoyalty", () => {
  test("throws ContextError when customerAccount is missing", async () => {
    const context = { customerAccount: undefined, storefront: {} } as unknown as Context;

    await expect(queryCustomerLoyalty(context)).rejects.toBeInstanceOf(ContextError);
  });

  test("returns null when the customer is not logged in", async () => {
    const context = makeContext({ isLoggedIn: async () => false });

    expect(await queryCustomerLoyalty(context)).toBe(null);
  });

  test("returns null when the query reports GraphQL errors", async () => {
    const context = makeContext({
      query: async () => ({
        data: { customer: { id: "1", loyalty: { value: METAFIELD_VALUE } } },
        errors: [{ message: "boom" }],
      }),
    });

    expect(await queryCustomerLoyalty(context)).toBe(null);
  });

  test("returns null when there is no customer in the response", async () => {
    const context = makeContext({ query: async () => ({ data: { customer: null } }) });

    expect(await queryCustomerLoyalty(context)).toBe(null);
  });

  test("returns null when the loyalty metafield is absent", async () => {
    expect(await queryCustomerLoyalty(loggedInWith(null))).toBe(null);
  });

  test("returns null when the loyalty metafield value is empty", async () => {
    expect(await queryCustomerLoyalty(loggedInWith({ value: "" }))).toBe(null);
  });

  test("parses and camelCases a valid loyalty metafield", async () => {
    const result = await queryCustomerLoyalty(loggedInWith({ value: METAFIELD_VALUE }));

    expect(result).toEqual({
      balance: 100,
      currencyValue: 100,
      tierUid: "abc",
      pointValue: 1,
    });
  });

  test("returns null and logs when the query throws", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const context = makeContext({
      query: async () => {
        throw new Error("network down");
      },
    });

    expect(await queryCustomerLoyalty(context)).toBe(null);
    expect(errorSpy).toHaveBeenCalled();
  });
});
