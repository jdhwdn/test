import { describe, expect, it } from "vitest";
import { createWelcomeCard } from "./welcomeCard";

describe("welcome card renderer", () => {
  it("renders a PNG card with the member and guild information", async () => {
    const card = await createWelcomeCard({
      guildName: "Discord Guardian",
      memberName: "Mohammed",
      avatarUrl: "invalid-avatar-url",
      message: "مرحباً <@123> في Discord Guardian!",
    });

    expect(Buffer.isBuffer(card)).toBe(true);
    expect(card.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true);
    expect(card.length).toBeGreaterThan(5_000);
  });
});
