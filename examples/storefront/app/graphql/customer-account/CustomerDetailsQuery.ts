// Mirrors the library's exported `CUSTOMER_LOYALTY_METAFIELD_FRAGMENT`
// (`@teamlunaris/easypoints-hydrogen/server`). The library ships the fragment string as the
// source of truth; merchants embed it in a file their own GraphQL codegen scans (the
// `app/graphql/customer-account/*` glob) so the generated types include `customer.loyalty`.
// Parse it with `keysToCamel` + `JSON.parse` and hand the result to `<CustomerLoyalty>` /
// `<TierProgress>`.
const CUSTOMER_LOYALTY_METAFIELD_FRAGMENT = `#graphql
  fragment CustomerLoyaltyMetafield on Customer {
    loyalty: metafield(namespace: "loyalty", key: "easy_points_attributes") {
      value
      type
    }
  }
` as const;

// NOTE: https://shopify.dev/docs/api/customer/latest/objects/Customer
export const CUSTOMER_FRAGMENT = `#graphql
  fragment Customer on Customer {
    id
    firstName
    lastName
    defaultAddress {
      ...Address
    }
    addresses(first: 6) {
      nodes {
        ...Address
      }
    }
    ...CustomerLoyaltyMetafield
  }
  fragment Address on CustomerAddress {
    id
    formatted
    firstName
    lastName
    company
    address1
    address2
    territoryCode
    zoneCode
    city
    zip
    phoneNumber
  }
  ${CUSTOMER_LOYALTY_METAFIELD_FRAGMENT}
` as const;

// NOTE: https://shopify.dev/docs/api/customer/latest/queries/customer
export const CUSTOMER_DETAILS_QUERY = `#graphql
  query CustomerDetails($language: LanguageCode) @inContext(language: $language) {
    customer {
      ...Customer
    }
  }
  ${CUSTOMER_FRAGMENT}
` as const;
