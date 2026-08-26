import { describe, expect, it } from "vitest";
import { createDashboardSession, DASHBOARD_SESSION_COOKIE, getDashboardSessionUser, validateDashboardPassword } from "./dashboardAuth";

describe("dashboard password session", () => {
  it("accepts the configured server-only dashboard password and creates a signed session", async () => {
    const password = process.env.DASHBOARD_PASSWORD ?? "";
    expect(validateDashboardPassword(password)).toBe(true);
    await expect(createDashboardSession()).resolves.toEqual(expect.any(String));
  });

  it("rejects an incorrect dashboard password", () => {
    expect(validateDashboardPassword("wrong-dashboard-password")).toBe(false);
  });

  it("does not reject a configured password merely because it is shorter than a recommendation", () => {
    const priorPassword = process.env.DASHBOARD_PASSWORD;
    process.env.DASHBOARD_PASSWORD = "قصير123";
    expect(validateDashboardPassword("قصير123")).toBe(true);
    process.env.DASHBOARD_PASSWORD = priorPassword;
  });

  it("restores an admin user from the independent dashboard cookie", async () => {
    const token = await createDashboardSession();
    const user = await getDashboardSessionUser({ headers: { cookie: `${DASHBOARD_SESSION_COOKIE}=${token}` } } as never);
    expect(user).toMatchObject({ role: "admin", loginMethod: "dashboard-password" });
  });
});
