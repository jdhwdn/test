import { describe, expect, it } from "vitest";
import { canManageTicketCategory, isValidTicketCategorySelection } from "./ticketCategoryRules";

describe("ticket category rules", () => {
  it("requires a visible manageable Discord category", () => {
    expect(canManageTicketCategory({ isCategory: true, botCanView: true, botCanManageChannels: true })).toBe(true);
    expect(canManageTicketCategory({ isCategory: true, botCanView: true, botCanManageChannels: false })).toBe(false);
    expect(canManageTicketCategory({ isCategory: false, botCanView: true, botCanManageChannels: true })).toBe(false);
  });

  it("accepts no parent or a selected category from this guild only", () => {
    expect(isValidTicketCategorySelection(["cat-1"], null)).toBe(true);
    expect(isValidTicketCategorySelection(["cat-1"], "cat-1")).toBe(true);
    expect(isValidTicketCategorySelection(["cat-1"], "other-guild")).toBe(false);
  });
});
