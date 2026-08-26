import { describe, expect, it } from "vitest";

const integrationIt = process.env.RUN_EXTERNAL_INTEGRATION_TESTS === "true" ? it : it.skip;

describe("ElevenLabs server secret", () => {
  integrationIt("authenticates with the configured server-only API key", async () => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    expect(apiKey, "ELEVENLABS_API_KEY must be set").toBeTruthy();

    const response = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
      headers: { "xi-api-key": apiKey! },
    });

    expect(response.ok, `ElevenLabs authentication failed with ${response.status}`).toBe(true);
  }, 15_000);

  integrationIt("can read the configured Majlsawi conversation agent", async () => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const agentId = process.env.ELEVENLABS_AGENT_ID;
    expect(apiKey, "ELEVENLABS_API_KEY must be set").toBeTruthy();
    expect(agentId, "ELEVENLABS_AGENT_ID must be set").toBeTruthy();

    const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(agentId!)}`, {
      headers: { "xi-api-key": apiKey! },
    });

    expect(response.ok, `ElevenLabs agent check failed with ${response.status}`).toBe(true);
  }, 15_000);
});
