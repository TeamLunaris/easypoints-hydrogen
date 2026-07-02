import { parseCustomerLoyalty } from "../shared/customer-loyalty";

import { ContextError } from "./errors";
import { CUSTOMER_LOYALTY_QUERY } from "./graphql";

import type { Context } from "./loyalty";
import type { CustomerLoyaltyMetafield } from "../types";

/** Shape of the `CustomerLoyalty` query result (no codegen, so typed explicitly). */
interface CustomerLoyaltyQueryData {
  customer: {
    id: string;
    loyalty: { value: string | null; type?: string | null } | null;
  } | null;
}

/**
 * Fetches and normalizes the logged-in customer's loyalty metafield.
 *
 * Runs the {@link CUSTOMER_LOYALTY_QUERY} against the Customer Account API, parses the JSON
 * `easy_points_attributes` metafield, and camelCases its keys into a {@link CustomerLoyaltyMetafield}.
 *
 * Returns `null` (rather than throwing) for every "no data" path so callers can render an
 * unauthenticated/empty state without branching on errors:
 * - the customer is not logged in;
 * - the query returns GraphQL errors or no `customer`;
 * - the loyalty metafield is absent/empty;
 * - the parsed metafield fails schema validation (the issues are logged to `console.error`);
 * - the request throws (the error is logged to `console.error`).
 *
 * @param context - The initialized loyalty {@link Context} (must carry a `customerAccount`).
 * @returns The customer's normalized loyalty attributes, or `null` when unavailable.
 * @throws {ContextError} If `context.customerAccount` is missing.
 */
export async function queryCustomerLoyalty(
  context: Context,
): Promise<CustomerLoyaltyMetafield | null> {
  const { customerAccount } = context;

  if (!customerAccount) {
    throw new ContextError();
  }

  try {
    const isLoggedIn = await customerAccount.isLoggedIn();
    if (!isLoggedIn) return null;

    const { data, errors } =
      await customerAccount.query<CustomerLoyaltyQueryData>(CUSTOMER_LOYALTY_QUERY);
    if (errors?.length || !data?.customer) return null;

    // Parse + validate + carry the session-authenticated customer GID through (so callers like
    // redeemPoints authorize against it rather than a client-supplied id). Shares the isomorphic
    // helper with merchants who piggyback the fragment onto their own customer-account query.
    return parseCustomerLoyalty(data.customer);
  } catch (error) {
    console.error("Error fetching customer loyalty:", error);
    return null;
  }
}
