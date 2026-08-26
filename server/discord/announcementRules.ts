export type AnnouncementDeliveryPlan =
  | { allowed: true; roleMentionId: string | null }
  | { allowed: false; reason: "unauthorized" | "not_text_channel" | "bot_cannot_send" | "bot_cannot_embed" | "role_not_mentionable" };

export function assessAnnouncementDelivery(input: { authorized: boolean; isTextChannel: boolean; botCanSend: boolean; botCanEmbed: boolean; requestedRoleId?: string | null; roleMentionable?: boolean; botCanMentionRoles?: boolean }): AnnouncementDeliveryPlan {
  if (!input.authorized) return { allowed: false, reason: "unauthorized" };
  if (!input.isTextChannel) return { allowed: false, reason: "not_text_channel" };
  if (!input.botCanSend) return { allowed: false, reason: "bot_cannot_send" };
  if (!input.botCanEmbed) return { allowed: false, reason: "bot_cannot_embed" };
  if (input.requestedRoleId && !input.roleMentionable && !input.botCanMentionRoles) return { allowed: false, reason: "role_not_mentionable" };
  return { allowed: true, roleMentionId: input.requestedRoleId ?? null };
}
