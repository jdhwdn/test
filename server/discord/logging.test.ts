import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";
import { parseJailRoles, selectEnabledLogRoute } from "../db";
import { buildLogEmbed } from "./logging";

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "guardian-admin",
      email: "admin@example.com",
      name: "Guardian Admin",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("Discord embed logging", () => {
  it("creates a polished moderation embed with executor, target, reason, and before/after fields", () => {
    const embed = buildLogEmbed({
      category: "moderation",
      eventKey: "moderation.mute",
      title: "Moderation action • MUTE",
      accentColor: "#ED4245",
      icon: "🛡️",
      actorId: "111",
      actorLabel: "Mod One",
      targetId: "222",
      targetLabel: "Member Two",
      reason: "Repeated spam",
      details: { Before: "Not muted", After: "Server muted" },
    });

    const json = embed.toJSON();
    expect(json.title).toBe("Moderation action • MUTE");
    expect(json.color).toBe(0xed4245);
    expect(json.author?.name).toContain("MODERATION LOG");
    expect(json.fields?.map(field => field.name)).toEqual(
      expect.arrayContaining(["Executor", "Affected member / item", "Reason", "Before", "After"]),
    );
    expect(json.footer?.text).toContain("moderation.mute");
  });

  it("rejects a log-routing category outside the supported Discord log taxonomy", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    await expect(
      caller.logging.saveRoute({
        guildId: "123",
        category: "unsupported" as never,
        channelId: "456",
        enabled: true,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("selects only the enabled destination belonging to the requested log category", () => {
    const route = selectEnabledLogRoute(
      [
        { category: "moderation", channelId: "moderation-room", enabled: true },
        { category: "voice", channelId: "voice-room", enabled: true },
        { category: "interactions", channelId: "bot-actions-room", enabled: true },
        { category: "messages", channelId: "disabled-room", enabled: false },
      ],
      "voice",
    );
    expect(route?.channelId).toBe("voice-room");
    expect(selectEnabledLogRoute([{ category: "interactions", channelId: "bot-actions-room", enabled: true }], "interactions")?.channelId).toBe("bot-actions-room");
    expect(selectEnabledLogRoute([{ category: "messages", channelId: "disabled-room", enabled: false }], "messages")).toBeUndefined();
  });

  it("rejects moderation and welcome settings that exceed safe dashboard bounds", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    await expect(caller.settings.save({
      guildId: "123",
      guildName: "Test guild",
      warningLimit: 0,
      botEnabled: true,
      welcomeEnabled: false,
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.settings.save({
      guildId: "123",
      guildName: "Test guild",
      warningLimit: 3,
      botEnabled: true,
      welcomeEnabled: true,
      welcomeMessage: "x".repeat(1801),
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("keeps only valid role snapshots for a jailed member", () => {
    expect(parseJailRoles(JSON.stringify([
      { id: "role-a", name: "Staff" },
      { id: 123, name: "Malformed" },
      { id: "role-b" },
    ]))).toEqual([{ id: "role-a", name: "Staff" }]);
    expect(parseJailRoles("not-json")).toEqual([]);
  });

  it("validates command-role and server-guard configuration before persistence", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    await expect(caller.permissions.save({
      guildId: "123",
      commandKey: "not-a-command" as never,
      roleId: "456",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.settings.save({
      guildId: "123",
      guildName: "Test guild",
      guardWindowSeconds: 5,
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects an invalid dashboard URL before it can be shared by the Discord command", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    await expect(caller.settings.save({
      guildId: "123",
      guildName: "Test guild",
      dashboardUrl: "not-a-url",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
