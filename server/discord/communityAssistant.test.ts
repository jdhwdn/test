import { describe, expect, it } from "vitest";
import { canUseLocalAssistant, draftComplaint, findKnowledgeAnswer, prepareTicketSummaryMetadata, suggestEventIdea, summarizeTicketMetadata } from "./communityAssistant";

describe("local community assistant", () => {
  const items = [{ id: 1, kind: "rule" as const, title: "قانون الروابط", content: "الروابط الخارجية تحتاج موافقة المشرف.", enabled: true }];
  it("answers only from approved knowledge", () => {
    expect(findKnowledgeAnswer("هل أقدر أرسل روابط خارجية؟", items)).toContain("قانون الروابط");
    expect(findKnowledgeAnswer("كيف أربح سيارة؟", items)).toContain("ما لقيت جواباً مؤكداً");
  });
  it("creates bounded templates without pretending to be open chat", () => {
    expect(draftComplaint({ subject: "إزعاج", details: "تفاصيل", memberMention: "<@1>" })).toContain("عنوان الشكوى");
    expect(suggestEventIdea("الألعاب")).toContain("الألعاب");
  });
  it("applies a short local per-user cooldown", () => {
    expect(canUseLocalAssistant(1_000, 5_999)).toBe(false);
    expect(canUseLocalAssistant(1_000, 6_000)).toBe(true);
  });
  it("summarizes ticket metadata without any message content input", () => {
    const summary = summarizeTicketMetadata({ id: 4, openerLabel: "عضو", status: "claimed", claimedById: "22", createdAt: new Date("2026-01-01T00:00:00Z") });
    expect(summary).toContain("بيانات وصفية فقط");
    expect(summary).toContain("لا يقرأ مجلساوي محتوى الرسائل");
  });
  it("accepts staff metadata only for the matching guild and flags it for persistence", () => {
    expect(prepareTicketSummaryMetadata({ ticketGuildId: "a", requestedGuildId: "b", suppliedMetadata: "ملاحظة" })).toBeNull();
    expect(prepareTicketSummaryMetadata({ ticketGuildId: "a", requestedGuildId: "a", storedMetadata: "قديم", suppliedMetadata: "جديد" })).toEqual({ metadata: "جديد", shouldPersist: true });
  });
});
