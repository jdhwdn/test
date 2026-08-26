import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({ getGuildSettings: vi.fn(), listCommunityKnowledgeItems: vi.fn() }));
const logMocks = vi.hoisted(() => ({ logDiscordEvent: vi.fn() }));
vi.mock("../db", async importOriginal => ({ ...(await importOriginal<typeof import("../db")>()), getGuildSettings: dbMocks.getGuildSettings, listCommunityKnowledgeItems: dbMocks.listCommunityKnowledgeItems }));
vi.mock("./logging", () => ({ logDiscordEvent: logMocks.logDiscordEvent }));

import { handleCommunityCommand } from "./bot";

function makeInteraction(input: { guildId?: string; command?: "help" | "faq" | "complaint" | "eventidea"; strings?: Record<string, string> }) {
  return { guild: { id: input.guildId ?? "guild-a" }, channel: { isTextBased: () => true }, commandName: input.command ?? "help", user: { id: "member-a", username: "Member" }, options: { getString: (name: string) => input.strings?.[name] ?? "هل الروابط مسموحة؟" }, reply: vi.fn().mockResolvedValue(undefined) } as any;
}

describe("local assistant Discord flow", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it("refuses the disabled local assistant before reading knowledge", async () => {
    dbMocks.getGuildSettings.mockResolvedValue({ aiEnabled: false });
    const interaction = makeInteraction({});
    await handleCommunityCommand(interaction);
    expect(dbMocks.listCommunityKnowledgeItems).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true, content: expect.stringContaining("غير مفعّل") }));
  });
  it("uses approved knowledge privately, redacts input in logs, and applies cooldown", async () => {
    dbMocks.getGuildSettings.mockResolvedValue({ aiEnabled: true });
    dbMocks.listCommunityKnowledgeItems.mockResolvedValue([{ id: 1, kind: "rule", title: "قانون الروابط", content: "الروابط تحتاج موافقة.", enabled: true }]);
    const interaction = makeInteraction({ guildId: "guild-b" });
    await handleCommunityCommand(interaction);
    expect(dbMocks.listCommunityKnowledgeItems).toHaveBeenCalledWith("guild-b");
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true, content: expect.stringContaining("قانون الروابط") }));
    expect(logMocks.logDiscordEvent).toHaveBeenCalledWith(expect.objectContaining({ details: expect.objectContaining({ Input: "Not retained" }) }));
    const cooldown = makeInteraction({ guildId: "guild-b" });
    await handleCommunityCommand(cooldown);
    expect(cooldown.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true, content: expect.stringContaining("خمس ثوان") }));
  });

  it("generates complaint and event templates privately without retaining their supplied text", async () => {
    dbMocks.getGuildSettings.mockResolvedValue({ aiEnabled: true });
    const complaint = makeInteraction({ guildId: "guild-complaint", command: "complaint", strings: { subject: "عنوان خاص", details: "تفاصيل خاصة لا تسجل" } });
    await handleCommunityCommand(complaint);
    expect(complaint.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true, allowedMentions: { users: ["member-a"] }, content: expect.stringContaining("عنوان خاص") }));
    expect(logMocks.logDiscordEvent).toHaveBeenLastCalledWith(expect.objectContaining({ eventKey: "community_assistant.complaint", details: expect.objectContaining({ Input: "Not retained" }) }));
    expect(JSON.stringify(logMocks.logDiscordEvent.mock.calls)).not.toContain("تفاصيل خاصة لا تسجل");

    const eventIdea = makeInteraction({ guildId: "guild-event", command: "eventidea", strings: { topic: "ألعاب المجتمع" } });
    await handleCommunityCommand(eventIdea);
    expect(eventIdea.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true, content: expect.stringContaining("ألعاب المجتمع") }));
    expect(logMocks.logDiscordEvent).toHaveBeenLastCalledWith(expect.objectContaining({ eventKey: "community_assistant.eventidea", details: expect.objectContaining({ Input: "Not retained" }) }));
  });

  it("limits FAQ answers to approved FAQ entries and records only a redacted interaction summary", async () => {
    dbMocks.getGuildSettings.mockResolvedValue({ aiEnabled: true });
    dbMocks.listCommunityKnowledgeItems.mockResolvedValue([
      { id: 1, kind: "rule", title: "سؤال الروابط", content: "لا تستخدم هذا الجواب.", enabled: true },
      { id: 2, kind: "faq", title: "سؤال الروابط", content: "الجواب المعتمد للأسئلة الشائعة.", enabled: true },
    ]);
    const interaction = makeInteraction({ guildId: "guild-faq", command: "faq", strings: { question: "سؤال الروابط" } });
    await handleCommunityCommand(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true, content: expect.stringContaining("الجواب المعتمد") }));
    expect(logMocks.logDiscordEvent).toHaveBeenLastCalledWith(expect.objectContaining({ eventKey: "community_assistant.faq", details: expect.objectContaining({ Input: "Not retained" }) }));
  });
});
