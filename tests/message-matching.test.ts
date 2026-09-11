import assert from "node:assert/strict";
import test from "node:test";
import { subjectHasTrackingId } from "../src/graph/messages";

const parentId = "1234567890123456";

test("matches only the complete TrackingID token", () => {
  assert.equal(
    subjectHasTrackingId(`RE: TrackingID#${parentId} update`, parentId),
    true,
  );
  assert.equal(
    subjectHasTrackingId(`RE: trackingid#${parentId} update`, parentId),
    true,
  );
  assert.equal(
    subjectHasTrackingId(`RE: TrackingID#${parentId}001 update`, parentId),
    false,
  );
  assert.equal(subjectHasTrackingId(`Invoice ${parentId}`, parentId), false);
});
