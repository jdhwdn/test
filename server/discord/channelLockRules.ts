export function assessChannelLock(input: { requesterCanManageChannels: boolean; isTextChannel: boolean; botCanManageChannel: boolean }) {
  if (!input.requesterCanManageChannels) return { allowed: false as const, reason: "requester_forbidden" as const };
  if (!input.isTextChannel) return { allowed: false as const, reason: "not_text_channel" as const };
  if (!input.botCanManageChannel) return { allowed: false as const, reason: "bot_forbidden" as const };
  return { allowed: true as const };
}
