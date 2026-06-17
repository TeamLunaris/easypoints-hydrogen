import { expect, test } from "vite-plus/test";

import { VERSION } from "./index";

// Placeholder test — proves the test runner and the client entry resolve.
// Real behavioural tests land alongside the ported logic in the follow-up phase.
test("exposes a version string", () => {
  expect(typeof VERSION).toBe("string");
});
