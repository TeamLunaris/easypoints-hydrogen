/** Default loyalty API base endpoint. */
export const DEFAULT_ENDPOINT = "https://loyalty.slrs.io/api";

/** Explicit configuration replacing the storefront's global `Env`. */
export interface LoyaltyClientConfig {
  /** Bearer token (merchant reads this from `EASY_POINTS_API_TOKEN`). */
  token: string;
  /** Base endpoint override (merchant reads this from `EASY_POINTS_API_ENDPOINT`). */
  endpoint?: string;
}

/**
 * Gets the base endpoint for the loyalty API, defaults to <https://loyalty.slrs.io/api>.
 */
export function getBaseEndpoint(config: Pick<LoyaltyClientConfig, "endpoint">): string {
  return config.endpoint || DEFAULT_ENDPOINT;
}

/**
 * Gets the bearer token for the loyalty API from the explicit config.
 */
export function getBearerToken(
  config: Partial<Pick<LoyaltyClientConfig, "token">>,
): string | undefined {
  return config.token;
}

/**
 * Creates a new Headers object with loyalty API default headers and the provided headers.
 */
export function getHeaders({ headers = {}, token }: { headers?: HeadersInit; token: string }) {
  const newHeaders = new Headers(headers);

  newHeaders.set("Content-Type", "application/json");
  newHeaders.set("Authorization", `Bearer ${token}`);
  newHeaders.set("x-api-version", "2.0.0");

  return newHeaders;
}

/**
 * Gets the full URL for the loyalty API endpoint.
 */
export function getUrl(config: Pick<LoyaltyClientConfig, "endpoint">, endpoint: string): string {
  endpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  return `${getBaseEndpoint(config)}${endpoint}`;
}
