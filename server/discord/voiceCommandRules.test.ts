import { describe, expect, it } from "vitest";
import { assessBotVoicePermissions, assessVoiceCommandState } from "./voiceCommandRules";

describe("voice command safeguards", () => {
  it("requires both Connect and Speak permissions for the bot", () => {
    expect(assessBotVoicePermissions({ canConnect: false, canSpeak: true })).toMatchObject({ allowed: false, message: expect.stringContaining("Connect") });
    expect(assessBotVoicePermissions({ canConnect: true, canSpeak: false })).toMatchObject({ allowed: false, message: expect.stringContaining("Speak") });
    expect(assessBotVoicePermissions({ canConnect: true, canSpeak: true })).toEqual({ allowed: true });
  });

  it("rejects unapproved, not-in-voice, and mismatched-channel voice requests", () => {
    expect(assessVoiceCommandState({ authorized: false, action: "join", requesterVoiceChannelId: "a" })).toMatchObject({ allowed: false });
    expect(assessVoiceCommandState({ authorized: true, action: "join" })).toMatchObject({ allowed: false, message: expect.stringContaining("روم") });
    expect(assessVoiceCommandState({ authorized: true, action: "say", requesterVoiceChannelId: "a", botVoiceChannelId: "b" })).toMatchObject({ allowed: false, message: expect.stringContaining("نفس روم") });
  });

  it("allows a valid join, leave, and speech state", () => {
    expect(assessVoiceCommandState({ authorized: true, action: "join", requesterVoiceChannelId: "a" })).toEqual({ allowed: true });
    expect(assessVoiceCommandState({ authorized: true, action: "leave", botVoiceChannelId: "a" })).toEqual({ allowed: true });
    expect(assessVoiceCommandState({ authorized: true, action: "say", requesterVoiceChannelId: "a", botVoiceChannelId: "a" })).toEqual({ allowed: true });
  });
});
