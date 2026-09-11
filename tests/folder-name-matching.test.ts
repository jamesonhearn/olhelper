import assert from "node:assert/strict";
import test from "node:test";
import { isCaseFolderName } from "../src/graph/folders";

const parentId = "1234567890123456";

test("accepts exact and space-delimited descriptive case folders", () => {
  assert.equal(isCaseFolderName(parentId, parentId), true);
  assert.equal(
    isCaseFolderName(`${parentId} - Customer context`, parentId),
    true,
  );
});

test("does not match a collaboration ID as its parent folder", () => {
  assert.equal(isCaseFolderName(`${parentId}001`, parentId), false);
});
