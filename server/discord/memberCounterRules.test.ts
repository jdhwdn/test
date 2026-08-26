import { describe, expect, it } from "vitest";
import { buildMemberCountChannelName, canUpdateMemberCounter } from "./memberCounterRules";

describe("member counter rules", () => {
  it("renders a bounded, non-negative member count name", () => expect(buildMemberCountChannelName(-2)).toBe("👥 الأعضاء: 0"));
  it("requires an existing manageable channel", () => {
    expect(canUpdateMemberCounter({ channelExists: true, channelManageable: true })).toBe(true);
    expect(canUpdateMemberCounter({ channelExists: false, channelManageable: true })).toBe(false);
  });
});
