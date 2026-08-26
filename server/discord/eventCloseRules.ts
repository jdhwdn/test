export function assessEventClose(input: { requestedGuildId: string; eventGuildId?: string; status?: string }) {
  if (!input.eventGuildId || input.eventGuildId !== input.requestedGuildId) return { allowed: false as const, reason: "guild_scope" as const };
  if (input.status !== "scheduled") return { allowed: false as const, reason: "not_scheduled" as const };
  return { allowed: true as const };
}

export function formatEventRsvpSummary(rows: { state: "going" | "maybe" | "declined"; total: number }[]) {
  const totals = new Map(rows.map(row => [row.state, row.total]));
  return `✅ ذاهب: **${totals.get("going") ?? 0}**\n❔ محتمل: **${totals.get("maybe") ?? 0}**\n🚫 معتذر: **${totals.get("declined") ?? 0}**`;
}
