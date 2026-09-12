import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const manifest = readFileSync("manifest.xml", "utf8");
const commands = readFileSync("src/commands/commands.ts", "utf8");
const taskpane = readFileSync("src/taskpane/taskpane.ts", "utf8");

test("exposes a direct status command and task-pane case action menu", () => {
  assert.match(manifest, /xsi:type="VersionOverridesV1_1"/);
  assert.match(
    manifest,
    /<FunctionName>checkCaseStatusCommand<\/FunctionName>/,
  );
  assert.match(
    manifest,
    /<Control xsi:type="Menu" id="OlHelper\.CaseActions">/,
  );

  for (const action of ["track", "archive", "reopen", "repair"]) {
    assert.match(
      manifest,
      new RegExp(`taskpane\\.html\\?action=${action}`),
    );
  }
});

test("pins only the generic task pane entry point", () => {
  const pinningDeclarations =
    manifest.match(/<SupportsPinning>true<\/SupportsPinning>/g) ?? [];

  assert.equal(pinningDeclarations.length, 1);
  assert.match(
    manifest,
    /id="OlHelper\.OpenTaskpane"[\s\S]*?<SourceLocation resid="Taskpane\.Url"\/>[\s\S]*?<SupportsPinning>true<\/SupportsPinning>/,
  );
  assert.doesNotMatch(
    manifest,
    /<SourceLocation resid="Taskpane\.(?:Track|Archive|Reopen|Repair)\.Url"\/>\s*<SupportsPinning>/,
  );
});

test("completes the function command and reports status through Outlook", () => {
  assert.match(
    commands,
    /Office\.actions\.associate\(\s*"checkCaseStatusCommand"/,
  );
  assert.match(commands, /ProgressIndicator/);
  assert.match(commands, /InformationalMessage/);
  assert.match(commands, /ErrorMessage/);
  assert.match(commands, /finally\s*\{\s*event\.completed\(\)/);
});

test("task-pane action links only accept known lifecycle actions", () => {
  assert.match(taskpane, /new URLSearchParams\(window\.location\.search\)/);

  for (const action of ["track", "archive", "reopen", "repair"]) {
    assert.match(taskpane, new RegExp(`action === "${action}"`));
  }
});
