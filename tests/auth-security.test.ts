import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const auth = readFileSync("src/auth/auth.ts", "utf8");

test("uses the documented memory-only MSAL cache location", () => {
  assert.match(auth, /BrowserCacheLocation\.MemoryStorage/);
  assert.doesNotMatch(auth, /sessionStorage|localStorage|cacheStorage/);
});
