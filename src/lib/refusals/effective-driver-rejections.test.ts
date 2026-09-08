import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyDriverRejectionTimeline,
  type RejectionTimelineEvent,
} from "./effective-driver-rejections";

function rejected(
  bookingId: string,
  driverId: string | null,
  occurredAt: number,
): RejectionTimelineEvent {
  return {
    bookingId,
    driverId,
    type: "REJECTED",
    occurredAt,
  };
}

function accepted(
  bookingId: string,
  driverId: string,
  occurredAt: number,
): RejectionTimelineEvent {
  return {
    bookingId,
    driverId,
    type: "ACCEPTED",
    occurredAt,
  };
}

test(
  "one rejection counts once",
  () => {
    const result =
      classifyDriverRejectionTimeline([
        rejected("job-1", "X", 1),
      ]);

    assert.equal(
      result.effectiveDriverRejections,
      1,
    );
  },
);

test(
  "duplicate rejections count once per job and driver",
  () => {
    const result =
      classifyDriverRejectionTimeline([
        rejected("job-1", "X", 1),
        rejected("job-1", "X", 2),
        rejected("job-1", "X", 3),
      ]);

    assert.equal(
      result.rawRejectionAttempts,
      3,
    );
    assert.equal(
      result.duplicateRejectionAttempts,
      2,
    );
    assert.equal(
      result.effectiveDriverRejections,
      1,
    );
  },
);

test(
  "later acceptance by the same driver recovers the rejection",
  () => {
    const result =
      classifyDriverRejectionTimeline([
        rejected("job-1", "X", 1),
        accepted("job-1", "X", 2),
      ]);

    assert.equal(
      result.recoveredBySameDriver,
      1,
    );
    assert.equal(
      result.effectiveDriverRejections,
      0,
    );
  },
);

test(
  "acceptance by a different driver does not recover the rejection",
  () => {
    const result =
      classifyDriverRejectionTimeline([
        rejected("job-1", "X", 1),
        accepted("job-1", "Y", 2),
      ]);

    assert.equal(
      result.recoveredBySameDriver,
      0,
    );
    assert.equal(
      result.effectiveDriverRejections,
      1,
    );
  },
);

test(
  "reject accept reject leaves the final rejection effective",
  () => {
    const result =
      classifyDriverRejectionTimeline([
        rejected("job-1", "X", 1),
        accepted("job-1", "X", 2),
        rejected("job-1", "X", 3),
      ]);

    assert.equal(
      result.duplicateRejectionAttempts,
      1,
    );
    assert.equal(
      result.recoveredBySameDriver,
      0,
    );
    assert.equal(
      result.effectiveDriverRejections,
      1,
    );
  },
);

test(
  "unattributed rejection is audited but not charged to a driver",
  () => {
    const result =
      classifyDriverRejectionTimeline([
        rejected("job-1", null, 1),
      ]);

    assert.equal(
      result.unattributedRejectionAttempts,
      1,
    );
    assert.equal(
      result.effectiveDriverRejections,
      0,
    );
  },
);

test(
  "acceptance before rejection does not recover the rejection",
  () => {
    const result =
      classifyDriverRejectionTimeline([
        accepted("job-1", "X", 1),
        rejected("job-1", "X", 2),
      ]);

    assert.equal(
      result.recoveredBySameDriver,
      0,
    );
    assert.equal(
      result.effectiveDriverRejections,
      1,
    );
  },
);
