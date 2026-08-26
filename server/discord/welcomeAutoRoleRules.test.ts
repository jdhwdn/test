import { describe, expect, it } from "vitest";
import { assessWelcomeAutoRole } from "./welcomeAutoRoleRules";

describe("welcome auto-role rules", () => {
  const base = { configuredRoleId: "role", roleExists: true, roleEditable: true, roleSafe: true, alreadyHasRole: false, memberIsBot: false };
  it("allows only safe, manageable member roles", () => expect(assessWelcomeAutoRole(base)).toEqual({ allowed: true }));
  it("rejects bots, unmanageable roles, unsafe roles, and duplicate assignments", () => {
    expect(assessWelcomeAutoRole({ ...base, memberIsBot: true })).toMatchObject({ reason: "not_applicable" });
    expect(assessWelcomeAutoRole({ ...base, roleEditable: false })).toMatchObject({ reason: "unmanageable" });
    expect(assessWelcomeAutoRole({ ...base, roleSafe: false })).toMatchObject({ reason: "unsafe" });
    expect(assessWelcomeAutoRole({ ...base, alreadyHasRole: true })).toMatchObject({ reason: "already_has_role" });
  });
});
