export function canClaimSupportTicket(input: { status: "open" | "claimed" | "closed"; isStaff: boolean; hasManageChannels: boolean; isOpener: boolean }) {
  if (input.status !== "open") return { allowed: false as const, reason: "not_open" as const };
  if (!input.isStaff && !input.hasManageChannels) return { allowed: false as const, reason: "staff_required" as const };
  if (input.isOpener && !input.hasManageChannels) return { allowed: false as const, reason: "opener_cannot_claim" as const };
  return { allowed: true as const };
}

export function canCloseSupportTicket(input: { status: "open" | "claimed" | "closed"; isStaff: boolean; hasManageChannels: boolean; isOpener: boolean }) {
  if (input.status === "closed") return { allowed: false as const, reason: "already_closed" as const };
  if (!input.isStaff && !input.hasManageChannels && !input.isOpener) return { allowed: false as const, reason: "forbidden" as const };
  return { allowed: true as const };
}
