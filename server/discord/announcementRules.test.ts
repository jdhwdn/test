import { describe, expect, it } from "vitest";
import { assessAnnouncementDelivery } from "./announcementRules";

describe("announcement delivery rules", () => {
  const safe = { authorized: true, isTextChannel: true, botCanSend: true, botCanEmbed: true };
  it("allows a valid text embed and a mentionable role", () => {
    expect(assessAnnouncementDelivery({ ...safe, requestedRoleId: "role-1", roleMentionable: true })).toEqual({ allowed: true, roleMentionId: "role-1" });
  });
  it("rejects missing authorisation, unsuitable destinations, missing bot permissions, and unmentionable roles", () => {
    expect(assessAnnouncementDelivery({ ...safe, authorized: false })).toEqual({ allowed: false, reason: "unauthorized" });
    expect(assessAnnouncementDelivery({ ...safe, isTextChannel: false })).toEqual({ allowed: false, reason: "not_text_channel" });
    expect(assessAnnouncementDelivery({ ...safe, botCanEmbed: false })).toEqual({ allowed: false, reason: "bot_cannot_embed" });
    expect(assessAnnouncementDelivery({ ...safe, requestedRoleId: "role-1", roleMentionable: false, botCanMentionRoles: false })).toEqual({ allowed: false, reason: "role_not_mentionable" });
  });
});
