import { describe, expect, it, vi } from "vitest";
import { handleCommunityCommand } from "./bot";

describe("/adminassist jail-role preview", () => {
  it("turns the natural Arabic jail-role request into a private confirmation preview without executing it", async () => {
    const interaction = {
      guild: { id: "guild-jail", name: "Guild" },
      channel: { isTextBased: () => true },
      commandName: "adminassist",
      memberPermissions: { has: () => true },
      user: { id: "manager-1", username: "Manager" },
      options: { getString: () => "انشى رتبة اسمها تالف خاصة بالسجن مايشوف الا روم ss" },
      reply: vi.fn().mockResolvedValue(undefined),
    } as any;

    await handleCommunityCommand(interaction);

    expect(interaction.reply).toHaveBeenCalledOnce();
    const response = interaction.reply.mock.calls[0]?.[0];
    expect(response).toMatchObject({ ephemeral: true });
    expect(response.embeds[0].data.description).toContain("تالف");
    expect(response.embeds[0].data.description).toContain("#ss");
    expect(response.components[0].components[0].data.custom_id).toMatch(/^adminassist:confirm:/);
  });
});
