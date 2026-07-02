import * as v from "valibot";

import { keysToCamel } from "./case";
import { CustomerLoyaltyMetafieldValueSchema } from "./loyalty-schema";

import type { CustomerLoyaltyMetafield } from "./loyalty-schema";

/**
 * Parses the raw `easy_points_attributes` customer metafield JSON into a validated, camelCased
 * {@link CustomerLoyaltyMetafield}.
 *
 * Use it when you piggyback {@link CUSTOMER_LOYALTY_METAFIELD_FRAGMENT} onto a customer-account query
 * you already make (e.g. the account page's `CUSTOMER_DETAILS_QUERY`) and want to avoid the extra
 * round-trip that `EasyPointsClient.getCustomerLoyalty()` would cost. The server client uses this
 * same helper internally, so both paths validate identically and cannot drift.
 *
 * Returns `null` (never throws) for every "no data" path so callers can render a signed-out/empty
 * state without branching on errors:
 * - `rawValue` is absent/empty (metafield unset, or customer signed out);
 * - the JSON fails to parse (logged to `console.error`);
 * - the parsed value fails schema validation (logged to `console.error`).
 *
 * @param rawValue - The raw metafield `value` string (`data.customer.loyalty?.value`), or nullish.
 * @param customerId - The session-authenticated Shopify customer GID (`data.customer.id`). Injected
 *   onto the result so callers (e.g. `redeemPoints`) authorize against it rather than a
 *   client-supplied id; it is not part of the metafield JSON.
 * @returns The normalized loyalty attributes, or `null` when unavailable/invalid.
 */
export function parseCustomerLoyalty(
  rawValue: string | null | undefined,
  customerId: string,
): CustomerLoyaltyMetafield | null {
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

  return { ...parsed.output, customerId };
}
