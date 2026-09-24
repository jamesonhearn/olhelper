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

test("deployment origin comes from the protected pilot environment", () => {
  assert.doesNotMatch(deploymentWorkflow, /inputs\.host_origin/);
  assert.match(
    deploymentWorkflow,
    /OLHELPER_HOST_ORIGIN:\s*\${{\s*vars\.OLHELPER_HOST_ORIGIN\s*}}/,
  );
  assert.match(
    deploymentWorkflow,
    /OLHELPER_CLIENT_ID:\s*\${{\s*vars\.OLHELPER_CLIENT_ID\s*}}/,
  );
});

test("hosted package generation does not accept an origin argument", () => {
  assert.match(
    manifestGenerator,
    /process\.env\.OLHELPER_HOST_ORIGIN/,
  );
  assert.match(manifestGenerator, /process\.env\.OLHELPER_CLIENT_ID/);
  assert.doesNotMatch(manifestGenerator, /originArgument\s*=\s*process\.argv/);
  assert.match(manifestGenerator, /olhelper-pilot\.zip/);
  assert.match(deploymentWorkflow, /appPackage\/build\/olhelper-pilot\.zip/);
});
