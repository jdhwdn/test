import { describe, expect, it } from "vitest";
import { sanitizeWelcomeCardConfig } from "./welcomeCardConfig";

describe("welcome card configuration", () => {
  it("allows only the supported font styles and safe HTTPS assets", () => {
    const config = sanitizeWelcomeCardConfig(JSON.stringify({ headingFont: "serif", bodyFont: "sans", backgroundImageUrl: "https://example.com/bg.png", logoUrl: "javascript:bad" }));
    expect(config.headingFont).toBe("serif");
    expect(config.bodyFont).toBe("sans");
    expect(config.backgroundImageUrl).toBe("https://example.com/bg.png");
    expect(config.logoUrl).toBeNull();
  });
  it("falls back for unknown font values", () => {
    const config = sanitizeWelcomeCardConfig(JSON.stringify({ headingFont: "external-font", bodyFont: "other" }));
    expect(config.headingFont).toBe("sans");
    expect(config.bodyFont).toBe("sans");
  });
});
