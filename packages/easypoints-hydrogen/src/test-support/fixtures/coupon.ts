// REST API response fixtures, validated against their Valibot schemas. Both are the camelCase shape
// (`api.fetch` runs `keysToCamel` before validation), so these match what a consumer receives.

import * as v from "valibot";

import { CreateCouponResponseSchema, ErrorResponseSchema } from "../../shared/loyalty-schema";

import type { CreateCouponResponse, ErrorResponse } from "../../types";

/** A successful coupon-creation response. Override any `data` field (e.g. `code`). */
export function couponResponse(
  overrides: Partial<CreateCouponResponse["data"]> = {},
): CreateCouponResponse {
  return v.parse(CreateCouponResponseSchema, {
    data: {
      code: "ABC123",
      currencyValue: 100,
      expiresAt: "2026-12-31",
      id: 1,
      pointValue: 500,
      pointsReimbursed: 0,
      posDiscount: false,
      reimbursementCascade: false,
      ...overrides,
    },
  });
}

/** An API error response. Override `errors` / `status` / `title` as needed. */
export function errorResponse(overrides: Partial<ErrorResponse> = {}): ErrorResponse {
  return v.parse(ErrorResponseSchema, {
    errors: [],
    status: 400,
    title: "Request failed",
    ...overrides,
  });
}
