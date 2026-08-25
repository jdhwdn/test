import { describe, expect, it } from "vitest";
import { buildInteractionLogDetails } from "./interactionLogging";

describe("interaction log privacy", () => {
  it("captures metadata while omitting directed-message content", () => {
    const memberMessage = "يا بوت هذا نص خاص لا يجب حفظه";
    const details = buildInteractionLogDetails({
      kind: "mention",
      channelId: "123",
      command: "voice request",
      outcome: "blocked",
      policy: "administrative_or_destructive",
    });

    expect(details).toMatchObject({
      Channel: "<#123>",
      Outcome: "blocked",
      Privacy: "Raw message text and voice audio are not stored",
    });
    expect(JSON.stringify(details)).not.toContain(memberMessage);
  });
});
