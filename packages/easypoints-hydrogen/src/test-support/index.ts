// Shared test infrastructure for the package. NOT a pack entry — never ships; only `vp test` /
// `vp check` see it. Import the React helpers (`./react`) directly from client tests so server
// tests don't transitively pull React through this barrel.

export { jsonResponse, setupFetchMock } from "./http";
export {
  makeCart,
  makeCustomerContext,
  makeLine,
  makeLoyaltyClient,
  makeStorefront,
} from "./context";
export { account, amount, loyaltyCustomer, loyaltyMetafield, tier } from "./fixtures/loyalty";
export { bonusCollection, SHOP_VALUE, shopValue } from "./fixtures/shop";
export { couponResponse, errorResponse } from "./fixtures/coupon";
