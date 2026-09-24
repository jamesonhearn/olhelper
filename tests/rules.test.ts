import assert from "node:assert/strict";
import test from "node:test";
import {
  hasExpectedManagedRuleDefinition,
  isManagedRuleForTrackingId,
  managedRuleName,
  type MessageRule,
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

function managedRule(
  overrides: Partial<MessageRule> = {},
): MessageRule {
  return {
    id: "rule-1",
    displayName: managedRuleName("1234123412341234"),
    sequence: 1,
    isEnabled: true,
    isReadOnly: false,
    hasError: false,
    conditions: {
      subjectContains: ["TrackingID#1234123412341234"],
    },
    exceptions: {},
    actions: {
      moveToFolder: "folder-1",
      stopProcessingRules: false,
    },
    ...overrides,
  };
}

test("accepts only the complete expected managed rule definition", () => {
  assert.equal(
    hasExpectedManagedRuleDefinition(
      managedRule(),
      "1234123412341234",
    ),
    true,
  );
});

test("rejects rules with unexpected conditions, exceptions, or actions", () => {
  const trackingId = "1234123412341234";

  assert.equal(
    hasExpectedManagedRuleDefinition(
      managedRule({
        conditions: {
          subjectContains: [`TrackingID#${trackingId}`],
          senderContains: ["attacker@example.com"],
        },
      }),
      trackingId,
    ),
    false,
  );
  assert.equal(
    hasExpectedManagedRuleDefinition(
      managedRule({ exceptions: { subjectContains: ["do-not-move"] } }),
      trackingId,
    ),
    false,
  );
  assert.equal(
    hasExpectedManagedRuleDefinition(
      managedRule({
        actions: {
          moveToFolder: "folder-1",
          forwardTo: [{ emailAddress: { address: "attacker@example.com" } }],
        },
      }),
      trackingId,
    ),
    false,
  );
});

test("rejects read-only, errored, mistargeted, or prefix-only rules", () => {
  const trackingId = "1234123412341234";

  assert.equal(
    hasExpectedManagedRuleDefinition(
      managedRule({ isReadOnly: true }),
      trackingId,
    ),
    false,
  );
  assert.equal(
    hasExpectedManagedRuleDefinition(
      managedRule({ hasError: true }),
      trackingId,
    ),
    false,
  );
  assert.equal(
    hasExpectedManagedRuleDefinition(
      managedRule({ actions: { moveToFolder: "" } }),
      trackingId,
    ),
    false,
  );
  assert.equal(
    hasExpectedManagedRuleDefinition(
      managedRule({
        conditions: {
          subjectContains: [`TrackingID#${trackingId}999`],
        },
      }),
      trackingId,
    ),
    false,
  );
});
