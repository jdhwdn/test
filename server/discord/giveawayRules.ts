export function assessGiveawayEntry(input: { giveawayGuildId?: string; requestedGuildId: string; status?: "active" | "ended" | "cancelled"; endsAt?: Date; requiredRoleId?: string | null; memberRoleIds: ReadonlySet<string>; minimumLevel: number; memberLevel: number; now: number }) {
  if (!input.giveawayGuildId || input.giveawayGuildId !== input.requestedGuildId) return { allowed: false as const, reason: "not_found" as const };
  if (input.status !== "active" || !input.endsAt || input.endsAt.getTime() <= input.now) return { allowed: false as const, reason: "closed" as const };
  if (input.requiredRoleId && !input.memberRoleIds.has(input.requiredRoleId)) return { allowed: false as const, reason: "required_role" as const };
  if (input.memberLevel < input.minimumLevel) return { allowed: false as const, reason: "minimum_level" as const };
  return { allowed: true as const };
}
