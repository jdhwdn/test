import type { AdminAssistantProposal } from "./adminAssistantPolicy";

export type PendingAdminAssistantAction = { guildId: string; actorId: string; expiresAt: number; proposal: Exclude<AdminAssistantProposal, { kind: "refuse" }> };

export function validateAdminAssistantConfirmation(input: { pending: PendingAdminAssistantAction | undefined; guildId: string; actorId: string; now: number; hasManageGuild: boolean }) {
  if (!input.pending || input.pending.guildId !== input.guildId || input.pending.actorId !== input.actorId) return { allowed: false, reason: "not_owner" as const };
  if (input.pending.expiresAt < input.now) return { allowed: false, reason: "expired" as const };
  if (!input.hasManageGuild) return { allowed: false, reason: "permission_revoked" as const };
  return { allowed: true as const };
}

export function validateBotAdminAssistantCapability(proposal: Exclude<AdminAssistantProposal, { kind: "refuse" }>, capabilities: { manageChannels: boolean; manageRoles: boolean }) {
  if ((proposal.kind === "create_channel" || proposal.kind === "update_channel_visibility") && !capabilities.manageChannels) return { allowed: false, reason: "missing_manage_channels" as const };
  if (proposal.kind === "create_role" && !capabilities.manageRoles) return { allowed: false, reason: "missing_manage_roles" as const };
  if (proposal.kind === "create_jail_role" && !capabilities.manageRoles) return { allowed: false, reason: "missing_manage_roles" as const };
  if (proposal.kind === "create_jail_role" && !capabilities.manageChannels) return { allowed: false, reason: "missing_manage_channels" as const };
  return { allowed: true as const };
}
