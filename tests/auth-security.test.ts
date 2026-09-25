import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const auth = readFileSync("src/auth/auth.ts", "utf8");
const taskpane = readFileSync("src/taskpane/taskpane.ts", "utf8");
const sessionEnded = readFileSync(
  "src/session-ended/session-ended.html",
  "utf8",
);
const sessionEndedScript = readFileSync(
  "src/session-ended/session-ended.ts",
  "utf8",
);

test("uses the documented memory-only MSAL cache location", () => {
  assert.match(auth, /BrowserCacheLocation\.MemoryStorage/);
  assert.doesNotMatch(auth, /sessionStorage|localStorage|cacheStorage/);
});

test("unloads the authenticated document after Graph workflows", () => {
  assert.match(taskpane, /scheduleSecureSessionEnd\(\)/);
  assert.match(taskpane, /window\.setInterval/);
  assert.match(
    taskpane,
    /new URL\("session-ended\.html", window\.location\.href\)/,
  );
  assert.match(taskpane, /window\.location\.replace/);
  assert.match(sessionEnded, /appsforoffice\.microsoft\.com.*office\.js/i);
  assert.doesNotMatch(sessionEndedScript, /msal|auth\/auth|taskpane/i);
});

test("keeps read-only status checks in the active session", () => {
  assert.match(taskpane, /beginSecureOperation\(false\)/);
  assert.match(taskpane, /finishReadOnlyOperation\(\)/);
  assert.doesNotMatch(
    taskpane,
    /checkStatusButton\.addEventListener[\s\S]*?finally\s*\{\s*scheduleSecureSessionEnd\(\)/,
  );
});

test("releases the command runtime authentication context", () => {
  assert.match(auth, /export function releaseGraphAuthenticationContext/);
  assert.match(auth, /msal = undefined/);
});
