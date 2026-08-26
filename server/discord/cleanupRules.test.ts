import { describe, expect, it } from "vitest";
import { assessManualCleanup } from "./cleanupRules";

describe("manual cleanup rules", () => {
  const base = { requesterCanManageMessages: true, isTextChannel: true, botCanManageMessages: true, count: 20 };
  it("allows a bounded cleanup in a manageable text channel", () => expect(assessManualCleanup(base)).toEqual({ allowed: true }));
  it("rejects unsafe cleanup requests", () => {
    expect(assessManualCleanup({ ...base, count: 101 })).toMatchObject({ reason: "invalid_count" });
    expect(assessManualCleanup({ ...base, requesterCanManageMessages: false })).toMatchObject({ reason: "requester_forbidden" });
    expect(assessManualCleanup({ ...base, botCanManageMessages: false })).toMatchObject({ reason: "bot_forbidden" });
  });
});
