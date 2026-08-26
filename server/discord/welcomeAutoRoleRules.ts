export function assessWelcomeAutoRole(input: { configuredRoleId?: string | null; roleExists: boolean; roleEditable: boolean; roleSafe: boolean; alreadyHasRole: boolean; memberIsBot: boolean }) {
  if (!input.configuredRoleId || input.memberIsBot) return { allowed: false as const, reason: "not_applicable" as const };
  if (!input.roleExists || !input.roleEditable) return { allowed: false as const, reason: "unmanageable" as const };
  if (!input.roleSafe) return { allowed: false as const, reason: "unsafe" as const };
  if (input.alreadyHasRole) return { allowed: false as const, reason: "already_has_role" as const };
  return { allowed: true as const };
}
