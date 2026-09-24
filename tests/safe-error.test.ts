import assert from "node:assert/strict";
import test from "node:test";
import { getSafeErrorMessage } from "../src/security/safe-error";

test("preserves short application errors", () => {
  assert.equal(
    getSafeErrorMessage(new Error("No Outlook message is selected.")),
    "No Outlook message is selected.",
  );
});

test("replaces raw token and broker diagnostics", () => {
  const safeMessage =
    "Authentication or mailbox access failed. Retry the operation or contact the OLHelper support owner.";

  for (const message of [
    "OneAuth ApiContractViolation wam_telemetry={...}",
    "Request failed with access_token=secret",
    `Broker failure ${"x".repeat(400)}`,
  ]) {
    assert.equal(getSafeErrorMessage(new Error(message)), safeMessage);
  }
});

test("does not stringify unknown thrown values", () => {
  assert.equal(getSafeErrorMessage({ access_token: "secret" }), "Unexpected error");
});
