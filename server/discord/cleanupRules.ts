export function assessManualCleanup(input: { requesterCanManageMessages: boolean; isTextChannel: boolean; botCanManageMessages: boolean; count: number }) {
  if (!input.requesterCanManageMessages) return { allowed: false as const, reason: "requester_forbidden" as const };
  if (!input.isTextChannel) return { allowed: false as const, reason: "not_text_channel" as const };
  if (!input.botCanManageMessages) return { allowed: false as const, reason: "bot_forbidden" as const };
  if (!Number.isInteger(input.count) || input.count < 1 || input.count > 100) return { allowed: false as const, reason: "invalid_count" as const };
  return { allowed: true as const };
}
