/**
 * Query for the loyalty metafield on the shop.
 */
export const SHOP_LOYALTY_QUERY = `#graphql
  query ShopLoyalty {
    shop {
      loyalty: metafield(namespace: "loyalty", key: "easy_points_attributes") {
        value
      }
    }
  }
` as const;

/**
 * Fragment for the loyalty metafield on the customer.
 */
export const CUSTOMER_LOYALTY_METAFIELD_FRAGMENT = `#graphql
  fragment CustomerLoyaltyMetafield on Customer {
    loyalty: metafield(namespace: "loyalty", key: "easy_points_attributes") {
      value
      type
    }
  }
` as const;

/**
 * Query for the loyalty metafield on the customer.
 */
export const CUSTOMER_LOYALTY_QUERY = `#graphql
  query CustomerLoyalty {
    customer {
      id
      ...CustomerLoyaltyMetafield
    }
  }
  ${CUSTOMER_LOYALTY_METAFIELD_FRAGMENT}
` as const;

/**
 * Fragment for the bonus points metafield on a collection.
 */
export const COLLECTION_LOYALTY_METAFIELD_FRAGMENT = `#graphql
  fragment CollectionLoyaltyMetafield on Collection {
    bonusPoints: metafield(namespace: "loyalty", key: "bonus_points") {
      value
      type
    }
  }
` as const;

/**
 * Fragment for the loyalty metafield on a list of collections sorted by updated at.
 * @param firstCollections - The number of collections to return
 */
export const COLLECTIONS_LOYALTY_FRAGMENT = `#graphql
  fragment CollectionsLoyalty on Product {
    collections(first: $firstCollections) {
      nodes {
        id
        ...CollectionLoyaltyMetafield
      }
    }
  }
  ${COLLECTION_LOYALTY_METAFIELD_FRAGMENT}
` as const;

/**
 * Query for the loyalty metafield on a product.
 *
 * @param handle - The handle of the product
 * @param selectedOptions - The selected options of the product
 * @param country - The country to get the price in (defaults to US)
 * @param firstCollections - The number of collections to return (defaults to 10)
 */
export const PRODUCT_LOYALTY_QUERY = `#graphql
  query ProductLoyalty(
    $handle: String!
    $selectedOptions: [SelectedOptionInput!]!,
    $country: CountryCode = US,
    $firstCollections: Int = 10
  ) @inContext(country: $country) {
    product(handle: $handle) {
      id
      selectedOrFirstAvailableVariant(selectedOptions: $selectedOptions) {
        price {
          amount
          currencyCode
        }
      }
      ...CollectionsLoyalty
    }
  }
  ${COLLECTIONS_LOYALTY_FRAGMENT}
` as const;
