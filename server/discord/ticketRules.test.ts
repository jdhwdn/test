import { describe, expect, it } from "vitest";
import { canClaimSupportTicket, canCloseSupportTicket } from "./ticketRules";

describe("support ticket rules", () => {
  it("allows only support staff or channel managers to claim an open ticket", () => {
    expect(canClaimSupportTicket({ status: "open", isStaff: true, hasManageChannels: false, isOpener: false })).toEqual({ allowed: true });
    expect(canClaimSupportTicket({ status: "open", isStaff: false, hasManageChannels: false, isOpener: true })).toMatchObject({ reason: "staff_required" });
    expect(canClaimSupportTicket({ status: "claimed", isStaff: true, hasManageChannels: false, isOpener: false })).toMatchObject({ reason: "not_open" });
  });
  it("allows the opener or staff to close only open or claimed tickets", () => {
    expect(canCloseSupportTicket({ status: "claimed", isStaff: false, hasManageChannels: false, isOpener: true })).toEqual({ allowed: true });
    expect(canCloseSupportTicket({ status: "closed", isStaff: true, hasManageChannels: false, isOpener: false })).toMatchObject({ reason: "already_closed" });
  });
});
