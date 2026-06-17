// Isomorphic, secret-free case conversion. Browser-safe; zero runtime deps.
//
// Replaces the storefront's `keysToCamel` (backed by lodash-es `camelCase`) with an
// internal minimal `camelCase` that handles snake_case and kebab-case input.

/**
 * Convert a single snake_case / kebab-case / space-separated string to camelCase.
 * Already-camelCase strings (no separators) pass through unchanged.
 */
function camelCase(input: string): string {
  return input
    .replace(/[_\-\s]+(.)?/g, (_match, char: string | undefined) =>
      char ? char.toUpperCase() : "",
    )
    .replace(/^[A-Z]/, (char) => char.toLowerCase());
}

/**
 * Recursively convert all object keys of `value` to camelCase.
 *
 * - Objects: keys converted, values recursed.
 * - Arrays: each element recursed.
 * - Other (scalars, null, undefined): returned untouched.
 */
export function keysToCamel<T = unknown>(value: unknown): T {
  if (Array.isArray(value)) {
    return value.map((item) => keysToCamel(item)) as T;
  }

  if (typeof value === "object" && value !== null) {
    return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>(
      (acc, [key, val]) => {
        acc[camelCase(key)] = keysToCamel(val);
        return acc;
      },
      {},
    ) as T;
  }

  return value as T;
}
