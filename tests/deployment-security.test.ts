import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const deploymentWorkflow = readFileSync(
  ".github/workflows/deploy-pilot.yml",
  "utf8",
);
const manifestGenerator = readFileSync(
  "scripts/create-hosted-manifest.mjs",
  "utf8",
);
const deploymentConfiguration = readFileSync(
  "scripts/deployment-config.mjs",
  "utf8",
);
const hostedSecurityVerifier = readFileSync(
  "scripts/verify-hosted-security.mjs",
  "utf8",
);

test("deployment origin is pinned in reviewed source", () => {
  assert.doesNotMatch(deploymentWorkflow, /inputs\.host_origin/);
  assert.doesNotMatch(deploymentWorkflow, /OLHELPER_HOST_ORIGIN/);
  assert.match(
    deploymentWorkflow,
    /OLHELPER_CLIENT_ID:\s*\${{\s*vars\.OLHELPER_CLIENT_ID\s*}}/,
  );
  assert.match(
    deploymentConfiguration,
    /const approvedOrigin\s*=\s*\n?\s*"https:\/\/purple-river-07ccd4a10\.6\.azurestaticapps\.net"/,
  );
  assert.doesNotMatch(
    manifestGenerator,
    /process\.env\.OLHELPER_HOST_ORIGIN/,
  );
});

test("hosted package generation does not accept an origin override", () => {
  assert.match(manifestGenerator, /process\.env\.OLHELPER_CLIENT_ID/);
  assert.doesNotMatch(manifestGenerator, /originArgument\s*=\s*process\.argv/);
  assert.doesNotMatch(manifestGenerator, /process\.env\.OLHELPER_HOST_ORIGIN/);
  assert.match(manifestGenerator, /olhelper-pilot\.zip/);
  assert.match(deploymentWorkflow, /appPackage\/build\/olhelper-pilot\.zip/);
});

test("deployment verifies the live security headers before publishing", () => {
  assert.match(
    deploymentWorkflow,
    /name:\s*Verify hosted security headers[\s\S]*?npm run security:verify-hosted/,
  );
  assert.match(hostedSecurityVerifier, /staticwebapp\.config\.json/);
  assert.match(hostedSecurityVerifier, /method:\s*"HEAD"/);
  assert.match(hostedSecurityVerifier, /response\.headers\.get\(name\)/);
  assert.match(hostedSecurityVerifier, /const attempts = 10/);
});
