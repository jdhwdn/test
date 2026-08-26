import { describe, expect, it } from "vitest";
import { validateAdminAssistantConfirmation, validateBotAdminAssistantCapability } from "./adminAssistantExecution";

const pending = { guildId: "guild", actorId: "owner", expiresAt: 2_000, proposal: { kind: "create_role" as const, name: "منظم" } };

describe("admin assistant execution checks", () => {
  it("allows only the owner before expiry while the permission remains", () => {
    expect(validateAdminAssistantConfirmation({ pending, guildId: "guild", actorId: "owner", now: 1_000, hasManageGuild: true })).toEqual({ allowed: true });
    expect(validateAdminAssistantConfirmation({ pending, guildId: "guild", actorId: "other", now: 1_000, hasManageGuild: true })).toMatchObject({ allowed: false, reason: "not_owner" });
  });
  it("rejects expiry and a revoked management permission", () => {
    expect(validateAdminAssistantConfirmation({ pending, guildId: "guild", actorId: "owner", now: 2_001, hasManageGuild: true })).toMatchObject({ reason: "expired" });
    expect(validateAdminAssistantConfirmation({ pending, guildId: "guild", actorId: "owner", now: 1_000, hasManageGuild: false })).toMatchObject({ reason: "permission_revoked" });
  });
  it("requires bot hierarchy capabilities for the proposed resource type", () => {
    expect(validateBotAdminAssistantCapability(pending.proposal, { manageChannels: true, manageRoles: false })).toMatchObject({ reason: "missing_manage_roles" });
    expect(validateBotAdminAssistantCapability({ kind: "update_channel_visibility", channelName: "staff", visibility: "private" }, { manageChannels: false, manageRoles: true })).toMatchObject({ reason: "missing_manage_channels" });
  });
});
