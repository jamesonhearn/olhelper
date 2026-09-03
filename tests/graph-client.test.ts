import assert from "node:assert/strict";
import test from "node:test";
import { buildGraphUrl } from "../src/graph/client";

test("builds a Microsoft Graph v1 URL from an API path", () => {
  assert.equal(
    buildGraphUrl("/me/messages"),
    "https://graph.microsoft.com/v1.0/me/messages",
  );
});

test("allows Graph pagination URLs", () => {
  const url =
    "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messageRules?$skip=10";

  assert.equal(buildGraphUrl(url), url);
});

test("rejects URLs outside the Graph v1 boundary", () => {
  assert.throws(() => buildGraphUrl("https://example.com/steal"));
  assert.throws(() => buildGraphUrl("https://graph.microsoft.com/beta/me"));
  assert.throws(() =>
    buildGraphUrl("https://graph.microsoft.com.evil.example/v1.0/me"),
  );
});
