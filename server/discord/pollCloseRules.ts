export function assessPollClose(input: { requestedGuildId: string; pollGuildId?: string; status?: string }) {
  if (!input.pollGuildId || input.pollGuildId !== input.requestedGuildId) return { allowed: false as const, reason: "guild_scope" as const };
  if (input.status !== "active") return { allowed: false as const, reason: "not_active" as const };
  return { allowed: true as const };
}

export function formatPollResults(rows: { label: string; position: number; votes: number }[]) {
  const total = rows.reduce((sum, row) => sum + row.votes, 0);
  return rows.map(row => `${row.position + 1}. **${row.label}** — ${row.votes} (${total ? Math.round((row.votes / total) * 100) : 0}%)`).join("\n") || "لا توجد خيارات.";
}
