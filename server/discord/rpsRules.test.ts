import { describe, expect, it } from "vitest";
import { canPlayRps, resolveRps } from "./rpsRules";

describe("rps rules", () => {
  it("resolves win, lose, and draw deterministically", () => {
    expect(resolveRps("rock", "scissors")).toBe("win");
    expect(resolveRps("rock", "paper")).toBe("lose");
    expect(resolveRps("rock", "rock")).toBe("draw");
  });
  it("enforces a per-member cooldown", () => {
    expect(canPlayRps(100, 30_099)).toBe(false);
    expect(canPlayRps(100, 30_100)).toBe(true);
  });
});
