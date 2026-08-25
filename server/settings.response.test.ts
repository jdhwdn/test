import { describe, expect, it } from "vitest";
import { nullableDashboardSettings } from "./routers";

describe("dashboard settings response", () => {
  it("returns null rather than undefined when a guild has no settings row yet", () => {
    expect(nullableDashboardSettings(undefined)).toBeNull();
  });

  it("preserves an existing settings record", () => {
    const settings = { guildId: "guild-1", voiceConversationChannelId: "voice-1" };
    expect(nullableDashboardSettings(settings)).toEqual(settings);
  });
});
