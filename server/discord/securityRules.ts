import type { SavedJailRole } from "../db";

export type RoleCandidate = SavedJailRole & { editable: boolean };

export function planJailRoles(roles: RoleCandidate[], everyoneRoleId: string, jailRoleId: string) {
  const snapshot = roles
    .filter(role => role.id !== everyoneRoleId && role.id !== jailRoleId)
    .map(role => ({ id: role.id, name: role.name }));
  const removed = roles
    .filter(role => role.id !== everyoneRoleId && role.id !== jailRoleId && role.editable)
    .map(role => ({ id: role.id, name: role.name }));
  const preserved = snapshot.filter(role => !removed.some(removedRole => removedRole.id === role.id));
  return { snapshot, removed, preserved };
}

export function selectRestorableRoles(savedRoles: SavedJailRole[], editableRoleIds: string[]) {
  return {
    restorable: savedRoles.filter(role => editableRoleIds.includes(role.id)),
    unavailable: savedRoles.filter(role => !editableRoleIds.includes(role.id)),
  };
}

export function canReleaseJail(releasedAt: Date | null) {
  return releasedAt === null;
}

export function hasConfiguredRoleAccess(allowedRoleIds: string[], memberRoleIds: string[]) {
  return allowedRoleIds.length === 0 || memberRoleIds.some(roleId => allowedRoleIds.includes(roleId));
}

export function evaluateGuardWindow(timestamps: number[], now: number, windowMs: number, limit: number) {
  const active = timestamps.filter(timestamp => now - timestamp <= windowMs);
  active.push(now);
  return { active, triggered: active.length > limit };
}

export function buildGuardLogDetails(input: {
  scope: "roles" | "channels" | "bans";
  limit: number;
  windowSeconds: number;
  affectedLabel: string;
  removedRoleCount: number;
  bypassConfigured: boolean;
}) {
  return {
    "Protected resource": input.affectedLabel,
    "Protection rule": `${input.scope} ≤ ${input.limit} per ${input.windowSeconds}s`,
    "Remediation": input.removedRoleCount ? `Removed ${input.removedRoleCount} bot-manageable role(s).` : "No removable role was available; review the hierarchy immediately.",
    "Bypass policy": input.bypassConfigured ? "Configured bypass roles are exempt." : "Only the server owner is exempt until a bypass role is configured.",
  };
}
