import { describe, expect, it } from "vitest";

const integrationIt = process.env.RUN_EXTERNAL_INTEGRATION_TESTS === "true" ? it : it.skip;

describe("Discord bot token", () => {
  integrationIt("authenticates against Discord's current bot identity endpoint", async () => {
    const token = process.env.DISCORD_BOT_TOKEN;
    expect(token, "DISCORD_BOT_TOKEN must be configured").toBeTruthy();

    const response = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bot ${token}` },
    });

    expect(response.ok, `Discord returned ${response.status}`).toBe(true);
    const bot = (await response.json()) as { id?: string; bot?: boolean };
    expect(bot.id).toBeTruthy();
    expect(bot.bot).toBe(true);
  }, 15_000);
});
