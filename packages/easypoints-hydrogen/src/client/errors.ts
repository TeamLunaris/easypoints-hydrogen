// Client-side error types shared across the hooks.

/**
 * Thrown when a hook is missing a required piece of context — pass the named value explicitly or
 * mount an `EasyPointsProvider` that supplies it. `providerHint` names what the provider would
 * supply (e.g. `"a customer ID"`).
 */
export class MissingContextError extends Error {
  constructor(field: string, providerHint: string) {
    super(
      `Missing \`${field}\`: pass it explicitly or mount an EasyPointsProvider with ${providerHint}.`,
    );
    this.name = "MissingContextError";
  }
}
