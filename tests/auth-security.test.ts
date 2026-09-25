import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const auth = readFileSync("src/auth/auth.ts", "utf8");
const taskpane = readFileSync("src/taskpane/taskpane.ts", "utf8");
const sessionEnded = readFileSync("src/session-ended.html", "utf8");

test("uses the documented memory-only MSAL cache location", () => {
  assert.match(auth, /BrowserCacheLocation\.MemoryStorage/);
  assert.doesNotMatch(auth, /sessionStorage|localStorage|cacheStorage/);
});

test("unloads the authenticated document after Graph workflows", () => {
  assert.match(taskpane, /scheduleSecureSessionEnd\(\)/);
  assert.match(taskpane, /window\.setTimeout\(endSecureSession,\s*10_000\)/);
  assert.match(
    taskpane,
    /new URL\("session-ended\.html", window\.location\.href\)/,
  );
  assert.match(taskpane, /window\.location\.replace/);
  assert.doesNotMatch(
    sessionEnded,
    /<script\b|office\.js|taskpane\.(?:js|ts)/i,
  );
});

test("releases the command runtime authentication context", () => {
  assert.match(auth, /export function releaseGraphAuthenticationContext/);
  assert.match(auth, /msal = undefined/);
});
