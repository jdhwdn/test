export type SuggestionStatus = "open" | "accepted" | "declined" | "implemented";

export function assessSuggestionStatusUpdate(input: { suggestionGuildId?: string; requestedGuildId: string; currentStatus?: SuggestionStatus; requestedStatus: string }) {
  if (!input.suggestionGuildId || input.suggestionGuildId !== input.requestedGuildId) return { allowed: false as const, reason: "guild_scope" as const };
  if (input.currentStatus !== "open") return { allowed: false as const, reason: "already_decided" as const };
  if (!["accepted", "declined", "implemented"].includes(input.requestedStatus)) return { allowed: false as const, reason: "invalid_status" as const };
  return { allowed: true as const, status: input.requestedStatus as Exclude<SuggestionStatus, "open"> };
}
