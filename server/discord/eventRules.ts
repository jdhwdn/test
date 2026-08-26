export function assessEventRsvp(input: { requestedGuildId: string; eventGuildId?: string; status?: "scheduled" | "completed" | "cancelled"; state: string }) {
  if (!input.eventGuildId || input.eventGuildId !== input.requestedGuildId) return { allowed: false as const, reason: "not_found" as const };
  if (input.status !== "scheduled") return { allowed: false as const, reason: "closed" as const };
  if (!(["going", "maybe", "declined"] as const).includes(input.state as "going" | "maybe" | "declined")) return { allowed: false as const, reason: "invalid_state" as const };
  return { allowed: true as const };
}
