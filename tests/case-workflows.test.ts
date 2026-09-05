import assert from "node:assert/strict";
import test from "node:test";
import {
  archiveCase,
  getCaseStatus,
  reopenCase,
  repairCaseRouting,
  trackCase,
  type CaseMailboxOperations,
} from "../src/cases/case-workflows";
import type {
  CaseFolderState,
  CaseLocation,
  MailFolder,
} from "../src/graph/folders";
import type { MessageRule } from "../src/graph/rules";

function createOperations(
  state: CaseFolderState,
  existingRule: MessageRule | null = null,
): CaseMailboxOperations & { calls: string[] } {
  const calls: string[] = [];
  const folder = state.folder ?? {
    id: "active-folder",
    displayName: "CASE-1",
  };
  const rule = existingRule ?? {
    id: "rule-1",
    displayName: "OLHelper | TrackingID#CASE-1",
    sequence: 1,
    isEnabled: false,
    actions: { moveToFolder: folder.id },
  };

  return {
    calls,
    async ensureActiveFolder() {
      calls.push("ensure-folder");
      return folder;
    },
    async getFolderState() {
      calls.push("get-state");
      return state;
    },
    async moveFolder(
      _folderId: string,
      destination: Exclude<CaseLocation, "untracked">,
    ) {
      calls.push(`move-folder:${destination}`);
      return { ...folder, id: `${destination}-folder` };
    },
    async moveMessage() {
      calls.push("move-message");
      return { id: "moved-message" };
    },
    async ensureRule() {
      calls.push("ensure-rule");
      return rule;
    },
    async findRule() {
      calls.push("find-rule");
      return existingRule;
    },
    async setRuleEnabled(_ruleId: string, enabled: boolean) {
      calls.push(`set-rule:${enabled}`);
      return { ...rule, isEnabled: enabled };
    },
    async updateRuleTarget() {
      calls.push("update-rule-target");
      return {
        ...rule,
        isEnabled: false,
        actions: { moveToFolder: folder.id },
      };
    },
    async deleteRule() {
      calls.push("delete-rule");
    },
  };
}

test("tracks a case by moving the message before enabling routing", async () => {
  const operations = createOperations({
    location: "untracked",
    folder: null,
  });

  const result = await trackCase("CASE-1", "message-1", operations);

  assert.equal(result.movedMessageId, "moved-message");
  assert.deepEqual(operations.calls, [
    "get-state",
    "ensure-folder",
    "ensure-rule",
    "move-message",
    "set-rule:true",
  ]);
});

test("does not track a message into an archived case", async () => {
  const operations = createOperations({
    location: "archived",
    folder: { id: "archived-folder", displayName: "CASE-1" },
  });

  await assert.rejects(
    trackCase("CASE-1", "message-1", operations),
    /is archived/,
  );
  assert.deepEqual(operations.calls, ["get-state"]);
});

test("archives an active case after disabling its rule", async () => {
  const existingRule: MessageRule = {
    id: "rule-1",
    displayName: "OLHelper | TrackingID#CASE-1",
    sequence: 1,
    isEnabled: true,
    actions: { moveToFolder: "active-folder" },
  };
  const operations = createOperations(
    {
      location: "active",
      folder: { id: "active-folder", displayName: "CASE-1" },
    },
    existingRule,
  );

  const result = await archiveCase("CASE-1", operations);

  assert.equal(result.location, "archived");
  assert.deepEqual(operations.calls, [
    "get-state",
    "find-rule",
    "set-rule:false",
    "move-folder:archived",
    "delete-rule",
  ]);
});

test("reopens an archived case and recreates routing", async () => {
  const operations = createOperations({
    location: "archived",
    folder: { id: "archived-folder", displayName: "CASE-1" },
  });

  const result = await reopenCase("CASE-1", operations);

  assert.equal(result.location, "active");
  assert.deepEqual(operations.calls, [
    "get-state",
    "find-rule",
    "move-folder:active",
    "ensure-rule",
    "set-rule:true",
  ]);
});

test("repairs routing only for an active case", async () => {
  const operations = createOperations({
    location: "active",
    folder: { id: "active-folder", displayName: "CASE-1" },
  });

  await repairCaseRouting("CASE-1", operations);

  assert.deepEqual(operations.calls, [
    "get-state",
    "find-rule",
    "ensure-rule",
    "set-rule:true",
  ]);
});

test("reports an active case with disabled routing", async () => {
  const operations = createOperations(
    {
      location: "active",
      folder: { id: "active-folder", displayName: "CASE-1" },
    },
    {
      id: "rule-1",
      displayName: "OLHelper | TrackingID#CASE-1",
      sequence: 1,
      isEnabled: false,
      actions: { moveToFolder: "active-folder" },
    },
  );

  const status = await getCaseStatus("CASE-1", operations);

  assert.deepEqual(status, {
    location: "active",
    routing: "disabled",
  });
  assert.deepEqual(operations.calls, ["get-state", "find-rule"]);
});

test("reports and repairs a rule that targets the wrong folder", async () => {
  const operations = createOperations(
    {
      location: "active",
      folder: { id: "active-folder", displayName: "CASE-1" },
    },
    {
      id: "rule-1",
      displayName: "OLHelper | TrackingID#CASE-1",
      sequence: 1,
      isEnabled: true,
      actions: { moveToFolder: "old-folder" },
    },
  );

  assert.deepEqual(await getCaseStatus("CASE-1", operations), {
    location: "active",
    routing: "mistargeted",
  });

  operations.calls.length = 0;
  await repairCaseRouting("CASE-1", operations);

  assert.deepEqual(operations.calls, [
    "get-state",
    "find-rule",
    "update-rule-target",
    "set-rule:true",
  ]);
});
