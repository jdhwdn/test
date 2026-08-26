import { beforeEach, describe, expect, it, vi } from "vitest";

const logMocks = vi.hoisted(() => ({ logDiscordEvent: vi.fn() }));
vi.mock("./logging", () => ({ logDiscordEvent: logMocks.logDiscordEvent }));

import { handleCommunityCommand, handleTriviaButton } from "./bot";

function makeStartInteraction(guildId = "guild-a") {
  return {
    guild: { id: guildId }, channel: { isTextBased: () => true }, commandName: "trivia", user: { id: "member-a", username: "Member" }, options: {}, reply: vi.fn().mockResolvedValue(undefined),
  } as any;
}

describe("Trivia Discord flow", () => {
  beforeEach(() => vi.clearAllMocks());
  it("creates owner-bound answer buttons and closes the round after its owner answers", async () => {
    const start = makeStartInteraction();
    await handleCommunityCommand(start);
    const payload = start.reply.mock.calls[0][0];
    const customId = payload.components[0].components[0].toJSON().custom_id;
    const button = { guild: { id: "guild-a" }, customId, user: { id: "member-a", username: "Member" }, message: { embeds: [] }, update: vi.fn().mockResolvedValue(undefined), reply: vi.fn().mockResolvedValue(undefined) } as any;
    await handleTriviaButton(button);
    expect(button.update).toHaveBeenCalledWith(expect.objectContaining({ components: [] }));
    expect(logMocks.logDiscordEvent).toHaveBeenCalledWith(expect.objectContaining({ eventKey: "trivia.answered" }));
  });
  it("refuses a button press from another member", async () => {
    const start = makeStartInteraction("guild-b");
    await handleCommunityCommand(start);
    const customId = start.reply.mock.calls[0][0].components[0].components[0].toJSON().custom_id;
    const button = { guild: { id: "guild-b" }, customId, user: { id: "member-b", username: "Other" }, message: { embeds: [] }, update: vi.fn(), reply: vi.fn().mockResolvedValue(undefined) } as any;
    await handleTriviaButton(button);
    expect(button.update).not.toHaveBeenCalled();
    expect(button.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true, content: expect.stringContaining("تخص") }));
  });
});
