// Client-side test seams: the `EasyPointsProvider` wrapper factory (shared by every hook test) and
// the reset helper for the mutable `useFetcher` stand-in.

import { beforeEach, vi } from "vite-plus/test";

import { EasyPointsProvider } from "../client/context";

import type { EasyPointsContext } from "../client/context";
import type { ReactNode } from "react";

/** A `renderHook` wrapper that mounts `EasyPointsProvider` with the given context value. */
export function createWrapper(value: EasyPointsContext) {
  return ({ children }: { children: ReactNode }) => (
    <EasyPointsProvider {...value}>{children}</EasyPointsProvider>
  );
}

/**
 * A single mutable fetcher standing in for `useFetcher`. Tests drive it by mutating `fetcher.data` /
 * `fetcher.state` and re-rendering, then assert on `submit`. Construct it in a per-file `vi.hoisted`
 * block (vitest hoists `vi.mock` above imports, so the mock can't be built from an import) and pass
 * it to `setupFetcherMock`.
 */
export interface FetcherMock<T> {
  submit: ReturnType<typeof vi.fn>;
  fetcher: { data: T | null | undefined; state: string; submit: ReturnType<typeof vi.fn> };
}

/** Resets a fetcher mock to its idle, dataless state. */
export function resetFetcherMock<T>(mock: FetcherMock<T>): void {
  mock.fetcher.data = undefined;
  mock.fetcher.state = "idle";
  mock.submit.mockClear();
}

/**
 * Registers a `beforeEach` that resets `mock` to its idle, dataless state. Call once at the top of a
 * hook test file (mirrors `setupFetchMock` on the server side) so no test has to remember to reset.
 */
export function setupFetcherMock<T>(mock: FetcherMock<T>): void {
  beforeEach(() => resetFetcherMock(mock));
}
