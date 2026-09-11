import assert from "node:assert/strict";
import test from "node:test";
import {
  caseFolderName,
  extractTrackingId,
} from "../src/cases/tracking-id";

test("extracts a supported tracking ID", () => {
  assert.equal(
    extractTrackingId("RE: Support case TrackingID#1234567890123456"),
    "1234567890123456",
  );
  assert.equal(
    extractTrackingId("RE: Collaboration TrackingID#1234567890123456001"),
    "1234567890123456001",
  );
});

test("rejects unsupported and nonnumeric identifiers", () => {
  assert.equal(extractTrackingId("TrackingID#../../Inbox"), null);
  assert.equal(extractTrackingId("TrackingID#OLH-1001"), null);
  assert.throws(() => caseFolderName("case/name"));
});

test("rejects identifiers outside the 16 to 19 digit boundary", () => {
  const tooShort = "1".repeat(15);
  const tooLong = "1".repeat(20);

  assert.equal(extractTrackingId(`TrackingID#${tooShort}`), null);
  assert.equal(extractTrackingId(`TrackingID#${tooLong}`), null);
  assert.throws(() => caseFolderName(tooShort));
  assert.throws(() => caseFolderName(tooLong));
});
