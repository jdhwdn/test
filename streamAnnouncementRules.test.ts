import { describe, expect, it } from "vitest";
import { createStreamWebhookSecret, hashStreamWebhookSecret, matchesStreamWebhookSecret, parseStreamWebhookEvent, streamEventKeyHash } from "./streamAnnouncementRules";

describe("stream announcement webhook rules", () => {
  it("accepts a bounded HTTPS live event and creates a deterministic event key", () => {
    const event = parseStreamWebhookEvent({ title: "جلسة مساء", url: "https://example.com/live", eventId: "stream-42", thumbnailUrl: "https://example.com/cover.png" });
    expect(event).toMatchObject({ title: "جلسة مساء", url: "https://example.com/live", eventId: "stream-42" });
    expect(streamEventKeyHash(2, event!.eventId)).toHaveLength(64);
  });
  it("rejects non-HTTPS or missing live fields", () => {
    expect(parseStreamWebhookEvent({ title: "بث", url: "http://example.com" })).toBeNull();
    expect(parseStreamWebhookEvent({ url: "https://example.com" })).toBeNull();
  });
  it("compares only the secret hash", () => {
    const secret = createStreamWebhookSecret();
    expect(matchesStreamWebhookSecret(secret, hashStreamWebhookSecret(secret))).toBe(true);
    expect(matchesStreamWebhookSecret("different", hashStreamWebhookSecret(secret))).toBe(false);
  });
});
