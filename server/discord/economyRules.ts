export function canUseEconomyAction(lastUsedAt: number | undefined, now: number, cooldownMs: number) {
  return !lastUsedAt || now - lastUsedAt >= cooldownMs;
}

export function assessRoleShopPurchase(input: { requestedGuildId: string; itemGuildId?: string; enabled?: boolean; roleExists: boolean; roleEditable: boolean; roleSafe: boolean; alreadyHasRole: boolean; balance: number; cost: number }) {
  if (!input.itemGuildId || input.itemGuildId !== input.requestedGuildId || !input.enabled) return { allowed: false as const, reason: "not_available" as const };
  if (!input.roleExists || !input.roleEditable) return { allowed: false as const, reason: "role_unmanageable" as const };
  if (!input.roleSafe) return { allowed: false as const, reason: "unsafe_role" as const };
  if (input.alreadyHasRole) return { allowed: false as const, reason: "already_owned" as const };
  if (input.balance < input.cost) return { allowed: false as const, reason: "insufficient_balance" as const };
  return { allowed: true as const };
}
