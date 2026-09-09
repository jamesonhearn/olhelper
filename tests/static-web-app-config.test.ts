import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

interface StaticWebAppConfig {
  globalHeaders?: Record<string, string>;
}

const config = JSON.parse(
  readFileSync("staticwebapp.config.json", "utf8"),
) as StaticWebAppConfig;

test("allows supported Outlook hosts to embed the task pane", () => {
  const policy = config.globalHeaders?.["Content-Security-Policy"];

  assert.ok(policy, "Content-Security-Policy must be configured");
  assert.match(
    policy,
    /frame-ancestors[^;]*https:\/\/outlook\.cloud\.microsoft(?:[;\s]|$)/,
  );
  assert.match(
    policy,
    /frame-ancestors[^;]*https:\/\/outlook\.office\.com(?:[;\s]|$)/,
  );
});
