// Copy of the library's exported `CUSTOMER_LOYALTY_METAFIELD_FRAGMENT`
// (`@teamlunaris/easypoints-hydrogen/server`). It must be copied, not imported: Hydrogen's GraphQL
// codegen only inlines fragment strings it finds in the files it scans (this
// `app/graphql/customer-account/*` glob) — it doesn't follow imports into `node_modules` — so the
// string has to live here for `customer.loyalty` to land in the generated types. In the loader,
// hand `data.customer.loyalty?.value` to `parseCustomerLoyalty` (see `routes/account.tsx`).
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
