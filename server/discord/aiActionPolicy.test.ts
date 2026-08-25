import { describe, expect, it } from "vitest";
import {
  authorizeAiAction,
  buildAiPolicyLogDetails,
  classifyMentionIntent,
} from "./aiActionPolicy";

describe("AI action safety policy", () => {
  it("rejects destructive Arabic and English requests before they can become actions", () => {
    expect(classifyMentionIntent("أبيك تخرب السيرفر وتحذف الروم")).toBe("blocked");
    expect(classifyMentionIntent("أبيك تطرد هذا العضو")).toBe("blocked");
    expect(classifyMentionIntent("delete this channel and ban everyone")).toBe("blocked");
  });

  it("recognises voice requests without treating them as server-administration requests", () => {
    expect(classifyMentionIntent("ميوت فلان في الروم الصوتي")).toBe("voice_request");
    expect(classifyMentionIntent("move this member to the waiting room")).toBe("voice_request");
    expect(classifyMentionIntent("ما هي قوانين السيرفر؟")).toBe("no_action");
  });

  it("allows only a complete allowlisted voice proposal", () => {
    expect(authorizeAiAction({ action: "mute", targetMemberId: "member-1" })).toMatchObject({ allowed: true, action: "mute" });
    expect(authorizeAiAction({ action: "move", targetMemberId: "member-1" })).toEqual({ allowed: false, reason: "missing_destination" });
    expect(authorizeAiAction({ action: "ban", targetMemberId: "member-1" })).toEqual({ allowed: false, reason: "not_allowlisted" });
    expect(authorizeAiAction({ action: "delete_channel" })).toEqual({ allowed: false, reason: "not_allowlisted" });
  });

  it("writes policy logs without retaining replayable message content", () => {
    expect(buildAiPolicyLogDetails({ intent: "blocked", reason: "not_allowlisted" })).toMatchObject({
      "Policy outcome": "Rejected before execution",
      "Allowed scope": expect.stringContaining("Voice"),
      "Request content": "Not retained in logs",
    });
  });
});
