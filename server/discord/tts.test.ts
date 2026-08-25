import { describe, expect, it } from "vitest";
import { canStartTts, canUsePlaybackState, getVoiceFeatureReadiness, markTtsStarted, normalizeTtsText, TTS_LIMITS } from "./tts";
import { AudioPlayerStatus } from "@discordjs/voice";

describe("independent Arabic TTS safeguards", () => {
  it("normalizes allowed speech and removes links", () => {
    expect(normalizeTtsText("  هلا   يا أهل القصيم https://example.com ")).toBe("هلا يا أهل القصيم");
  });

  it("rejects empty and oversized speech", () => {
    expect(() => normalizeTtsText("  ")).toThrow("/say");
    expect(() => normalizeTtsText("ا".repeat(TTS_LIMITS.MAX_TTS_CHARS + 1))).toThrow("الحد الأقصى");
  });

  it("enforces a short per-guild speech interval", () => {
    markTtsStarted("guild-test", 10_000);
    expect(canStartTts("guild-test", 12_999)).toBe(false);
    expect(canStartTts("guild-test", 13_000)).toBe(true);
  });

  it("does not begin speech while an existing player is buffering or speaking", () => {
    expect(canUsePlaybackState(AudioPlayerStatus.Playing)).toBe(false);
    expect(canUsePlaybackState(AudioPlayerStatus.Buffering)).toBe(false);
    expect(canUsePlaybackState(AudioPlayerStatus.Idle)).toBe(true);
  });

  it("reports the configuration required by the dashboard voice readiness cards", () => {
    const readiness = getVoiceFeatureReadiness();
    expect(readiness.sayReady).toBe(readiness.apiKeyConfigured && readiness.voiceIdConfigured);
    expect(readiness.conversationReady).toBe(readiness.sayReady && readiness.agentIdConfigured);
  });
});
