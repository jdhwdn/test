import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { describe, expect, it } from "vitest";
import { VoiceReadinessCards } from "./VoiceReadinessCards";

describe("VoiceReadinessCards", () => {
  it("renders the missing-variable guidance visibly", () => {
    const markup = renderToStaticMarkup(<VoiceReadinessCards readiness={{ sayReady: false, conversationReady: false }} />);
    expect(markup).toContain('data-testid="say-readiness"');
    expect(markup).toContain("ELEVENLABS_VOICE_ID");
    expect(markup).toContain("Agent ID");
  });

  it("renders ready guidance for both voice capabilities", () => {
    const markup = renderToStaticMarkup(<VoiceReadinessCards readiness={{ sayReady: true, conversationReady: true }} />);
    expect(markup).toContain("جاهز للنطق بالصوت المستقل");
    expect(markup).toContain("جاهزة في الروم المخصص ورتبة الموافقة");
  });
});
