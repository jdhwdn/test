export type KnowledgeItem = { id: number; kind: "rule" | "faq"; title: string; content: string; enabled: boolean };

export function canUseLocalAssistant(lastUsedAt: number | undefined, now: number, cooldownMs = 5_000) {
  return !lastUsedAt || now - lastUsedAt >= cooldownMs;
}

function tokens(value: string) {
  return value.toLocaleLowerCase("ar").split(/[^a-zA-Z0-9\u0600-\u06FF]+/).map(token => token.replace(/^ال/, "")).filter(token => token.length > 1).slice(0, 24);
}

export function findKnowledgeAnswer(query: string, items: KnowledgeItem[]) {
  const queryTokens = new Set(tokens(query));
  const ranked = items.filter(item => item.enabled).map(item => {
    const corpus = new Set(tokens(`${item.title} ${item.content}`));
    const score = Array.from(queryTokens).reduce((total, token) => total + (corpus.has(token) ? 1 : 0), 0);
    return { item, score };
  }).filter(result => result.score > 0).sort((left, right) => right.score - left.score || left.item.id - right.item.id);
  const match = ranked[0]?.item;
  if (!match) return "ما لقيت جواباً مؤكداً في القوانين أو الأسئلة الشائعة المصرح بها. افتح تذكرة للدعم أو اسأل الإدارة.";
  return `**${match.title}**\n${match.content.slice(0, 1500)}`;
}

export function draftComplaint(input: { subject: string; details: string; memberMention: string }) {
  return [`**عنوان الشكوى:** ${input.subject.trim().slice(0, 160)}`, `**صاحب الشكوى:** ${input.memberMention}`, `**التفاصيل:** ${input.details.trim().slice(0, 1400)}`, "**ملاحظة للإدارة:** راجعوا الأدلة وفق سياسة السيرفر، ولا تنشروا بيانات خاصة."].join("\n");
}

export function suggestEventIdea(topic: string) {
  const safeTopic = topic.trim().slice(0, 120) || "تفاعل المجتمع";
  return `فكرة فعالية محلية حول **${safeTopic}**: أعلنوا عن تحدٍ قصير بمدة 45 دقيقة، حدّدوا قواعد مشاركة واضحة وجائزة رمزية، واستخدموا تصويتاً من الأعضاء لاختيار أفضل مشاركة. راجعوا القواعد وأهليّة المشاركين قبل إعلان النتيجة.`;
}

export function summarizeTicketMetadata(input: { id: number; openerLabel: string; status: "open" | "claimed" | "closed"; claimedById?: string | null; closedById?: string | null; createdAt: Date; closedAt?: Date | null; staffSummaryMetadata?: string | null }) {
  const state = input.status === "open" ? "مفتوحة وتنتظر المتابعة" : input.status === "claimed" ? "مستلمة من أحد أفراد الفريق" : "مغلقة";
  return [
    `**ملخص تذكرة #${input.id} (بيانات وصفية فقط)**`,
    `- الحالة: ${state}`,
    `- صاحب التذكرة: ${input.openerLabel}`,
    `- أُنشئت: <t:${Math.floor(input.createdAt.getTime() / 1000)}:R>`,
    input.claimedById ? `- مستلمها: <@${input.claimedById}>` : "- لم تُسند لمشرف بعد.",
    input.closedById ? `- أغلقها: <@${input.closedById}>` : "",
    input.staffSummaryMetadata ? `- ملاحظات المشرف: ${input.staffSummaryMetadata.slice(0, 1800)}` : "- لا توجد ملاحظات وصفية أضافها المشرف.",
    "- خصوصية: لا يقرأ مجلساوي محتوى الرسائل ولا ينشئ Transcript في هذا الملخص.",
  ].filter(Boolean).join("\n");
}

export function prepareTicketSummaryMetadata(input: { ticketGuildId: string; requestedGuildId: string; storedMetadata?: string | null; suppliedMetadata?: string | null }) {
  if (input.ticketGuildId !== input.requestedGuildId) return null;
  const metadata = input.suppliedMetadata?.trim().slice(0, 1800) || input.storedMetadata || null;
  return { metadata, shouldPersist: Boolean(input.suppliedMetadata?.trim()) };
}
