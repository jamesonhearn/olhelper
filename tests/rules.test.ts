import assert from "node:assert/strict";
import test from "node:test";
import {
  isManagedRuleForTrackingId,
  managedRuleName,
} from "../src/graph/rules";

test("builds a recognizable managed rule name", () => {
  assert.equal(
    managedRuleName("CASE-1"),
    "OLHelper | TrackingID#CASE-1",
  );
});

test("matches managed rule names without duplicating identifier casing", () => {
  assert.equal(
    isManagedRuleForTrackingId(
      "OLHelper | TrackingID#case-1",
      "CASE-1",
    ),
    true,
  );
});
