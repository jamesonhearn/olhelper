import assert from "node:assert/strict";
import test from "node:test";
import {
  caseFolderName,
  extractTrackingId,
} from "../src/cases/tracking-id";

test("extracts a supported tracking ID", () => {
  assert.equal(
    extractTrackingId("RE: Support case TrackingID#OLH-1001"),
    "OLH-1001",
  );
});

test("rejects unsupported characters", () => {
  assert.equal(extractTrackingId("TrackingID#../../Inbox"), null);
  assert.throws(() => caseFolderName("case/name"));
});

test("does not truncate an overlong tracking ID", () => {
  const overlong = "A".repeat(65);

  assert.equal(extractTrackingId(`TrackingID#${overlong}`), null);
  assert.throws(() => caseFolderName(overlong));
});
