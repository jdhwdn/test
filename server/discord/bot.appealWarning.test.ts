import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({ saveWarningAppeal: vi.fn() }));
const logMocks = vi.hoisted(() => ({ logDiscordEvent: vi.fn() }));

vi.mock("../db", async importOriginal => ({
  ...(await importOriginal<typeof import("../db")>()),
  saveWarningAppeal: dbMocks.saveWarningAppeal,
}));
vi.mock("./logging", () => ({ logDiscordEvent: logMocks.logDiscordEvent }));

import { communityCommandNames, handleCommunityCommand } from "./bot";

function makeInteraction(input?: { guildId?: string; memberId?: string; warningId?: number; note?: string }) {
  return {
    guild: { id: input?.guildId ?? "guild-warning" },
    channel: { isTextBased: () => true },
    commandName: "appealwarning",
    user: { id: input?.memberId ?? "member-1", username: "Member" },
    options: {
      getInteger: () => input?.warningId ?? 17,
      getString: () => input?.note ?? "ملاحظة خاصة للطعن",
    },
    reply: vi.fn().mockResolvedValue(undefined),
  } as any;
}

describe("/appealwarning handler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("routes the command and saves one private note only for the invoking member in the current guild", async () => {
    dbMocks.saveWarningAppeal.mockResolvedValue(true);
    const interaction = makeInteraction({ guildId: "guild-a", memberId: "member-a", warningId: 23, note: "  ملاحظة خاصة للطعن  " });

    await handleCommunityCommand(interaction);

    expect(communityCommandNames.has("appealwarning")).toBe(true);
    expect(dbMocks.saveWarningAppeal).toHaveBeenCalledWith({ guildId: "guild-a", memberId: "member-a", id: 23, note: "ملاحظة خاصة للطعن" });
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true, allowedMentions: { parse: [] }, content: expect.stringContaining("بشكل خاص") }));
    expect(JSON.stringify(interaction.reply.mock.calls)).not.toContain("ملاحظة خاصة للطعن");
    expect(logMocks.logDiscordEvent).not.toHaveBeenCalled();
  });

  it("refuses an unknown, cross-guild, active, or previously appealed warning without exposing any record details", async () => {
    dbMocks.saveWarningAppeal.mockResolvedValue(false);
    const interaction = makeInteraction({ note: "لا تُعرض هذه الملاحظة" });

    await handleCommunityCommand(interaction);

    expect(dbMocks.saveWarningAppeal).toHaveBeenCalledWith({ guildId: "guild-warning", memberId: "member-1", id: 17, note: "لا تُعرض هذه الملاحظة" });
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true, allowedMentions: { parse: [] }, content: expect.stringContaining("لا يمكن إرسال طعن") }));
    expect(JSON.stringify(interaction.reply.mock.calls)).not.toContain("لا تُعرض هذه الملاحظة");
    expect(logMocks.logDiscordEvent).not.toHaveBeenCalled();
  });

  it("rejects an empty note before writing to the warning record", async () => {
    const interaction = makeInteraction({ note: "   " });

    await handleCommunityCommand(interaction);

    expect(dbMocks.saveWarningAppeal).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true, allowedMentions: { parse: [] }, content: expect.stringContaining("ملاحظة") }));
  });
});
