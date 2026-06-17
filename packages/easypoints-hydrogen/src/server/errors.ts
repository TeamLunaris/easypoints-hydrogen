interface ApiErrorParams {
  message?: string | null;
  endpoint: string;
  response: Response;
}

/**
 * Thrown when the loyalty API responds with a 5xx (server) error.
 */
export class LoyaltyClientError extends Error {
  endpoint: string;
  response: Response;

  private static getDefaultErrorMessage(endpoint: string, response: Response) {
    return `API request to ${endpoint} failed with status ${response.status} (${response.statusText})`;
  }

  constructor({ message = null, endpoint, response }: ApiErrorParams) {
    super(
      `[easyPoints] ${message ?? LoyaltyClientError.getDefaultErrorMessage(endpoint, response)}`,
    );

    this.endpoint = endpoint;
    this.response = response;
  }
}

/**
 * Thrown when the loyalty client is used before `init()` has supplied the Hydrogen context.
 */
export class ContextError extends Error {
  constructor(message?: string | null) {
    super(`[easyPoints] ${message ?? ContextError.getDefaultErrorMessage()}`);
  }

  private static getDefaultErrorMessage() {
    return "Context is not initialized";
  }
}
