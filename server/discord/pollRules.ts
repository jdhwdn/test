export function assessPollVote(input: { requestedGuildId: string; pollGuildId?: string; status?: "active" | "closed"; endsAt?: Date | null; optionExists: boolean; now: number }) {
  if (!input.pollGuildId || input.pollGuildId !== input.requestedGuildId) return { allowed: false as const, reason: "not_found" as const };
  if (input.status !== "active" || (input.endsAt && input.endsAt.getTime() <= input.now)) return { allowed: false as const, reason: "closed" as const };
  if (!input.optionExists) return { allowed: false as const, reason: "invalid_option" as const };
  return { allowed: true as const };
}
