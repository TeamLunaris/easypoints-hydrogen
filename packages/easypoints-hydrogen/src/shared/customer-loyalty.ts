import * as v from "valibot";

import { keysToCamel } from "./case";
import { CustomerLoyaltyMetafieldValueSchema } from "./loyalty-schema";

import type { CustomerLoyaltyMetafield } from "./loyalty-schema";

/**
 * The subset of a customer-account query result that {@link parseCustomerLoyalty} consumes: the
 * session-authenticated customer GID plus the `easy_points_attributes` metafield selected by
 * {@link CUSTOMER_LOYALTY_METAFIELD_FRAGMENT}. Nullable end-to-end so it accepts optional-chained
 * data (`data.customer`) for a signed-out customer without a guard at the call site.
 */
export type CustomerLoyaltyInput =
  | {
      id: string;
      loyalty?: { value: string | null | undefined } | null;
    }
  | null
  | undefined;

/**
 * Parses the raw `easy_points_attributes` customer metafield JSON into a validated, camelCased
 * {@link CustomerLoyaltyMetafield}.
 *
 * Use it when you piggyback {@link CUSTOMER_LOYALTY_METAFIELD_FRAGMENT} onto a customer-account query
 * you already make (e.g. the account page's `CUSTOMER_DETAILS_QUERY`) and want to avoid the extra
 * round-trip that `EasyPointsClient.getCustomerLoyalty()` would cost.
 *
 * Returns `null` (never throws) for every "no data" path so callers can render a signed-out/empty
 * state without branching on errors:
 * - `customer` is nullish (signed out) or its metafield value is absent/empty (metafield unset);
 * - the JSON fails to parse (logged to `console.error`);
 * - the parsed value fails schema validation (logged to `console.error`).
 *
 * @param customer - The customer node from a customer-account query (`data.customer`), or nullish.
 * @returns The normalized loyalty attributes, or `null` when unavailable/invalid.
 */
export function parseCustomerLoyalty(
  customer: CustomerLoyaltyInput,
): CustomerLoyaltyMetafield | null {
  if (!customer) return null;

  const rawValue = customer.loyalty?.value;
  if (!rawValue) return null;

  let json: unknown;
  try {
    json = JSON.parse(rawValue);
  } catch (error) {
    console.error("Failed to parse customer loyalty metafield:", error);
    return null;
  }

  // Validate the parsed JSON rather than trusting its shape: a malformed or partial metafield would
  // otherwise surface as runtime `undefined` where the type promises a complete object (e.g.
  // crashing `useTierProgress` on `tierMaintenanceData`).
  const parsed = v.safeParse(CustomerLoyaltyMetafieldValueSchema, keysToCamel(json));
  if (!parsed.success) {
    console.error("Invalid customer loyalty metafield:", v.flatten(parsed.issues));
    return null;
  }

  return { ...parsed.output, customerId: customer.id };
}
