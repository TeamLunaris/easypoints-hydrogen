# Changelog

All notable changes to `@teamlunaris/easypoints-hydrogen` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0-rc.1]

Initial release candidate: the easyPoints loyalty integration extracted into a standalone,
publishable library.

### Added

- **Server loyalty client** (`/server`): `createEasyPointsClient` factory (mounted as
  `context.loyalty`), the `createCartPointsAction` resource-route dispatcher (calculate / redeem /
  undo), `productPoints`, `queryCustomerLoyalty`, `fetchShopLoyalty`, error classes, and the
  loyalty GraphQL queries + fragments.
- **React hooks + provider** (`/client`): `EasyPointsProvider`, `useCartPoints`,
  `useCartRedemption`, `useTierProgress`, `useCustomerLoyalty`.
- **Headless render-prop components** (root entry): `CustomerLoyalty`, `TierProgress`,
  `ProductPoints`, `CartRedemption`.
- **Isomorphic utilities & types** (root + `/types`): `keysToCamel`, tier logic
  (`getCurrentTier`, `getNextTier`, `getMaintenanceTier`, `getProgressTier`), the cart-points route
  contract, and Valibot-backed domain types.

[Unreleased]: https://github.com/TeamLunaris/easypoints-hydrogen/compare/v0.1.0-rc.1...HEAD
[0.1.0-rc.1]: https://github.com/TeamLunaris/easypoints-hydrogen/releases/tag/v0.1.0-rc.1
