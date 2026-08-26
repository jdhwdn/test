import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({ getCommandRoleIds: vi.fn(), getSuggestionById: vi.fn(), updateSuggestionStatus: vi.fn() }));
const logMocks = vi.hoisted(() => ({ logDiscordEvent: vi.fn() }));

vi.mock("../db", async importOriginal => ({
  ...(await importOriginal<typeof import("../db")>()),
  getCommandRoleIds: dbMocks.getCommandRoleIds,
  getSuggestionById: dbMocks.getSuggestionById,
  updateSuggestionStatus: dbMocks.updateSuggestionStatus,
}));
vi.mock("./logging", () => ({ logDiscordEvent: logMocks.logDiscordEvent }));

import { handleSuggestionStatusButton } from "./bot";

function makeInteraction(guildId = "guild-a") {
  const moderator = { roles: { cache: new Map() }, permissions: { has: () => true } };
  return {
    guild: { id: guildId, members: { fetch: vi.fn().mockResolvedValue(moderator) } }, customId: "suggestion:status:9:accepted", user: { id: "moderator-a", username: "Moderator" },
    message: { embeds: [] }, update: vi.fn().mockResolvedValue(undefined), reply: vi.fn().mockResolvedValue(undefined),
  } as any;
}

describe("suggestion status button handler", () => {
  beforeEach(() => { vi.clearAllMocks(); dbMocks.getCommandRoleIds.mockResolvedValue([]); });
  it("updates an open suggestion only within the active guild and removes decision buttons", async () => {
    dbMocks.getSuggestionById.mockResolvedValue({ id: 9, guildId: "guild-a", status: "open" });
    dbMocks.updateSuggestionStatus.mockResolvedValue(true);
    const interaction = makeInteraction();
    await handleSuggestionStatusButton(interaction);
    expect(dbMocks.updateSuggestionStatus).toHaveBeenCalledWith({ guildId: "guild-a", id: 9, status: "accepted" });
    expect(interaction.update).toHaveBeenCalledWith(expect.objectContaining({ components: [] }));
    expect(logMocks.logDiscordEvent).toHaveBeenCalledWith(expect.objectContaining({ eventKey: "suggestion.status_updated", details: expect.objectContaining({ "Suggestion content": "Not retained in audit log" }) }));
  });
  it("refuses a suggestion owned by another guild before persistence", async () => {
    dbMocks.getSuggestionById.mockResolvedValue({ id: 9, guildId: "guild-b", status: "open" });
    const interaction = makeInteraction("guild-a");
    await handleSuggestionStatusButton(interaction);
    expect(dbMocks.updateSuggestionStatus).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true, content: expect.stringContaining("غير متاح") }));
  });
});
