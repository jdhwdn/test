import { describe, expect, it } from "vitest";
import {
  buildGuardLogDetails,
  canReleaseJail,
  evaluateGuardWindow,
  hasConfiguredRoleAccess,
  planJailRoles,
  selectRestorableRoles,
} from "./securityRules";

describe("jail role planning", () => {
  it("snapshots all non-everyone roles but removes only bot-manageable roles", () => {
    const plan = planJailRoles([
      { id: "everyone", name: "@everyone", editable: false },
      { id: "jail", name: "Jail", editable: true },
      { id: "member", name: "Member", editable: true },
      { id: "senior", name: "Senior staff", editable: false },
    ], "everyone", "jail");

    expect(plan.snapshot).toEqual([{ id: "member", name: "Member" }, { id: "senior", name: "Senior staff" }]);
    expect(plan.removed).toEqual([{ id: "member", name: "Member" }]);
    expect(plan.preserved).toEqual([{ id: "senior", name: "Senior staff" }]);
  });

  it("restores only roles still editable and releases a record only once", () => {
    const roles = [{ id: "member", name: "Member" }, { id: "missing", name: "Deleted role" }];
    expect(selectRestorableRoles(roles, ["member"])).toEqual({
      restorable: [{ id: "member", name: "Member" }],
      unavailable: [{ id: "missing", name: "Deleted role" }],
    });
    expect(canReleaseJail(null)).toBe(true);
    expect(canReleaseJail(new Date())).toBe(false);
  });
});

describe("role access and server guard", () => {
  it("uses a configured role when one exists and otherwise indicates the native fallback", () => {
    expect(hasConfiguredRoleAccess(["mod"], ["member", "mod"])).toBe(true);
    expect(hasConfiguredRoleAccess(["mod"], ["member"])).toBe(false);
    expect(hasConfiguredRoleAccess([], ["member"])).toBe(true);
  });

  it("triggers protection only when the configured rolling threshold is exceeded", () => {
    expect(evaluateGuardWindow([1_000, 3_000], 5_000, 10_000, 3)).toMatchObject({ triggered: false, active: [1_000, 3_000, 5_000] });
    expect(evaluateGuardWindow([1_000, 3_000, 5_000], 7_000, 10_000, 3)).toMatchObject({ triggered: true, active: [1_000, 3_000, 5_000, 7_000] });
  });

  it("builds a protection log with resource, rule, and remediation fields", () => {
    expect(buildGuardLogDetails({
      scope: "channels",
      limit: 3,
      windowSeconds: 60,
      affectedLabel: "Deleted channel #general",
      removedRoleCount: 2,
      bypassConfigured: true,
    })).toEqual({
      "Protected resource": "Deleted channel #general",
      "Protection rule": "channels ≤ 3 per 60s",
      "Remediation": "Removed 2 bot-manageable role(s).",
      "Bypass policy": "Configured bypass roles are exempt.",
    });
  });
});
