import { describe, expect, it } from "vitest";
import { assessChannelLock } from "./channelLockRules";

describe("channel lock rules", () => {
  const base = { requesterCanManageChannels: true, isTextChannel: true, botCanManageChannel: true };
  it("allows a manageable text channel", () => expect(assessChannelLock(base)).toEqual({ allowed: true }));
  it("rejects missing moderator permission, non-text channels, and unmanageable channels", () => {
    expect(assessChannelLock({ ...base, requesterCanManageChannels: false })).toMatchObject({ reason: "requester_forbidden" });
    expect(assessChannelLock({ ...base, isTextChannel: false })).toMatchObject({ reason: "not_text_channel" });
    expect(assessChannelLock({ ...base, botCanManageChannel: false })).toMatchObject({ reason: "bot_forbidden" });
  });
});
