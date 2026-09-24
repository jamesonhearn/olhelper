import assert from "node:assert/strict";
import test from "node:test";
import { buildGraphUrl } from "../src/graph/client";

test("builds a Microsoft Graph v1 URL from an API path", () => {
  assert.equal(
    buildGraphUrl("/me/mailFolders"),
    "https://graph.microsoft.com/v1.0/me/mailFolders",
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

test("rejects Graph APIs outside OLHelper's operation allowlist", () => {
  assert.throws(() => buildGraphUrl("/me/drive/root"));
  assert.throws(() => buildGraphUrl("/users/another-user/messages"));
  assert.throws(() =>
    buildGraphUrl("https://graph.microsoft.com/v1.0/me/messages"),
  );
});

test("allows only the folder, message move, and rule endpoint shapes", () => {
  for (const path of [
    "/me/mailFolders",
    "/me/mailFolders/folder-1/childFolders",
    "/me/mailFolders/folder-1/move",
    "/me/messages/message-1/move",
    "/me/mailFolders/inbox/messages?$select=id,subject",
    "/me/mailFolders/inbox/messageRules?$select=id,displayName",
    "/me/mailFolders/inbox/messageRules/rule-1?$select=actions",
  ]) {
    assert.doesNotThrow(() => buildGraphUrl(path), path);
  }
});
