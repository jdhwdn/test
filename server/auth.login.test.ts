import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { DASHBOARD_SESSION_COOKIE } from "./dashboardAuth";
import type { TrpcContext } from "./_core/context";

type CookieCall = { name: string; value: string; options: Record<string, unknown> };

function createLoginContext() {
  const cookies: CookieCall[] = [];
  const ctx: TrpcContext = {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => cookies.push({ name, value, options }),
    } as TrpcContext["res"],
  };
  return { ctx, cookies };
}

describe("auth.login", () => {
  it("sets a secure dashboard session for the configured password", async () => {
    const { ctx, cookies } = createLoginContext();
    const caller = appRouter.createCaller(ctx);

    const user = await caller.auth.login({ password: process.env.DASHBOARD_PASSWORD ?? "" });

    expect(user).toMatchObject({ role: "admin", loginMethod: "dashboard-password" });
    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toMatchObject({
      name: DASHBOARD_SESSION_COOKIE,
      options: { httpOnly: true, secure: true, sameSite: "lax", maxAge: 43_200_000 },
    });
    expect(cookies[0]?.value.length).toBeGreaterThan(20);
  });

  it("rejects an incorrect dashboard password", async () => {
    const { ctx } = createLoginContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.auth.login({ password: "incorrect-dashboard-password" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
