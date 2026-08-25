import { describe, expect, it } from "vitest";
import { deliverWelcomeCard } from "./welcomeDelivery";

const cardInput = {
  guildName: "Discord Guardian",
  memberName: "Member",
  avatarUrl: "invalid-avatar",
  message: "مرحباً @عضو جديد",
};

describe("welcome delivery", () => {
  it("sends a PNG attachment when the card renderer succeeds", async () => {
    const sent: Array<{ content: string; files?: unknown[]; allowedMentions: { users: string[] } }> = [];
    const delivery = await deliverWelcomeCard({
      memberId: "123",
      fallbackContent: "fallback",
      card: cardInput,
      renderCard: async () => Buffer.from([137, 80, 78, 71]),
      send: async payload => { sent.push(payload); },
    });

    expect(delivery).toBe("Dynamic welcome card");
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ content: "مرحباً <@123>", allowedMentions: { users: ["123"] } });
    expect(sent[0]?.files).toHaveLength(1);
  });

  it("sends the configured text fallback when rendering fails", async () => {
    const sent: Array<{ content: string; files?: unknown[]; allowedMentions: { users: string[] } }> = [];
    const delivery = await deliverWelcomeCard({
      memberId: "123",
      fallbackContent: "مرحباً <@123> في السيرفر",
      card: cardInput,
      renderCard: async () => { throw new Error("renderer unavailable"); },
      send: async payload => { sent.push(payload); },
    });

    expect(delivery).toBe("Text fallback after card-render error");
    expect(sent).toEqual([{ content: "مرحباً <@123> في السيرفر", allowedMentions: { users: ["123"] } }]);
  });
});
