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
    // Only transform plain objects; leave things like Date, URL, Map, etc. untouched.
    if (Object.prototype.toString.call(value) !== "[object Object]") {
      return value as T;
    }

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
