import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hasVoiceConversationConsent, isMajlsawiAddressed, pcmToWav, shouldStartDirectedVoiceConversation, startDirectedVoiceConversation, stopDirectedVoiceConversation, voiceConversationConfigured } from "./voiceConversation";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  stopDirectedVoiceConversation("guild-privacy-test");
});

describe("directed Majlsawi voice conversation safeguards", () => {
  it("only treats speech as directed when the caller uses the Majlsawi wake name", () => {
    expect(isMajlsawiAddressed("يا مجلساوي وش علومك؟")).toBe(true);
    expect(isMajlsawiAddressed("Majlsawi, hello")).toBe(true);
    expect(isMajlsawiAddressed("وش علوم الشباب اليوم؟")).toBe(false);
  });

  it("wraps in-memory PCM in a standard wav header for temporary transcription", () => {
    const wav = pcmToWav(Buffer.from([0, 1, 2, 3]));
    expect(wav.subarray(0, 4).toString()).toBe("RIFF");
    expect(wav.subarray(8, 12).toString()).toBe("WAVE");
    expect(wav.subarray(44)).toEqual(Buffer.from([0, 1, 2, 3]));
  });

  it("requires a private ElevenLabs agent in addition to TTS configuration", () => {
    const previous = { api: process.env.ELEVENLABS_API_KEY, agent: process.env.ELEVENLABS_AGENT_ID, voice: process.env.ELEVENLABS_VOICE_ID };
    process.env.ELEVENLABS_API_KEY = "test";
    process.env.ELEVENLABS_VOICE_ID = "voice";
    delete process.env.ELEVENLABS_AGENT_ID;
    expect(voiceConversationConfigured()).toBe(false);
    process.env.ELEVENLABS_AGENT_ID = "agent";
    expect(voiceConversationConfigured()).toBe(true);
    if (previous.api === undefined) delete process.env.ELEVENLABS_API_KEY; else process.env.ELEVENLABS_API_KEY = previous.api;
    if (previous.agent === undefined) delete process.env.ELEVENLABS_AGENT_ID; else process.env.ELEVENLABS_AGENT_ID = previous.agent;
    if (previous.voice === undefined) delete process.env.ELEVENLABS_VOICE_ID; else process.env.ELEVENLABS_VOICE_ID = previous.voice;
  });

  it("does not activate audio processing outside the explicitly configured Majlsawi room", () => {
    expect(shouldStartDirectedVoiceConversation("voice-majlsawi", "voice-majlsawi")).toBe(true);
    expect(shouldStartDirectedVoiceConversation("voice-majlsawi", "general-room")).toBe(false);
    expect(shouldStartDirectedVoiceConversation(null, "voice-majlsawi")).toBe(false);
  });

  it("requires the explicit conversation-consent role before subscribing to a member's audio", () => {
    expect(hasVoiceConversationConsent("consent-role", ["member", "consent-role"])).toBe(true);
    expect(hasVoiceConversationConsent("consent-role", ["member"])).toBe(false);
    expect(hasVoiceConversationConsent(null, ["consent-role"])).toBe(false);
  });

  it("does not subscribe to or transcribe a speaker without explicit consent", async () => {
    process.env.ELEVENLABS_API_KEY = "test-key";
    process.env.ELEVENLABS_AGENT_ID = "test-agent";
    process.env.ELEVENLABS_VOICE_ID = "test-voice";
    const speaking = new EventEmitter();
    const subscribe = vi.fn();
    const connection = { receiver: { speaking, subscribe } } as never;
    const onEvent = vi.fn();
    await startDirectedVoiceConversation({
      guild: { id: "guild-privacy-test" } as never,
      connection,
      channelId: "majlsawi-room",
      isMemberBlacklisted: async () => false,
      hasMemberVoiceConsent: async () => false,
      onEvent,
    });
    speaking.emit("start", "member-without-consent");
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(subscribe).not.toHaveBeenCalled();
    expect(onEvent).toHaveBeenCalledWith({ type: "ready" });
  });
});
