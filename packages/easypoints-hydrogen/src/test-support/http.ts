// Server-side fetch test seam. `setupFetchMock` registers the save/restore + timer hooks once per
// file and hands back installers for the two patterns the suite needs: a repeating handler and a
// per-call sequence (for the 429-retry-then-succeed path).

import { afterEach, beforeEach, vi } from "vite-plus/test";
import type { Mock } from "vite-plus/test";

/** Builds a JSON `Response`, defaulting to a `content-type: application/json` header. */
export const jsonResponse = (
  body: unknown,
  init?: { status?: number; statusText?: string; headers?: Record<string, string> },
) =>
  new Response(JSON.stringify(body), {
    status: init?.status,
    statusText: init?.statusText,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });

type FetchHandler = (...args: Parameters<typeof fetch>) => Promise<Response>;

/**
 * Installs `globalThis.fetch` mocking for the current test file. Restores the original `fetch` and
 * resets all mocks after each test (and forces real timers before each). Returns installers that
 * each set `globalThis.fetch` and return the underlying spy for assertions.
 */
export function setupFetchMock() {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  return {
    /** Every call runs `handler`. */
    mock(handler: FetchHandler): Mock<FetchHandler> {
      const spy = vi.fn(handler);
      globalThis.fetch = spy as unknown as typeof fetch;
      return spy;
    },

    /** The Nth call resolves to the Nth response; calls past the end resolve `undefined`. */
    mockOnce(...responses: Response[]): Mock<FetchHandler> {
      const spy = vi.fn<FetchHandler>();
      for (const response of responses) spy.mockResolvedValueOnce(response);
      globalThis.fetch = spy as unknown as typeof fetch;

      return spy;
    },
  };
}
