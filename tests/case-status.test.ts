import assert from "node:assert/strict";
import test from "node:test";
import { describeCaseStatus } from "../src/cases/case-status";

const trackingId = "1234567890123456";

test("describes each user-visible case state", () => {
  assert.equal(
    describeCaseStatus(trackingId, {
      location: "untracked",
      routing: "not-applicable",
    }),
    `Case ${trackingId} is not currently tracked.`,
  );
  assert.equal(
    describeCaseStatus(trackingId, {
      location: "archived",
      routing: "not-applicable",
    }),
    `Case ${trackingId} is archived and persistent routing is stopped.`,
  );
  assert.equal(
    describeCaseStatus(trackingId, {
      location: "active",
      routing: "enabled",
    }),
    `Case ${trackingId} is active and routing is enabled.`,
  );
  assert.equal(
    describeCaseStatus(trackingId, {
      location: "active",
      routing: "mistargeted",
    }),
    `Case ${trackingId} is active, but routing needs repair.`,
  );
});
