export type CommunityProgramRow = {
  id: "events" | "giveaways" | "engagement" | "tickets" | "streams" | "shop" | "ticketManagement";
  title: string;
  command: string;
  keywords: string[];
};

export const communityProgramRows: CommunityProgramRow[] = [
  { id: "events", title: "الفعاليات والتقويم", command: "/event · /eventend", keywords: ["فعالية", "تقويم", "rsvp", "event"] },
  { id: "giveaways", title: "السحوبات والجوائز", command: "/giveaway", keywords: ["سحب", "جائزة", "giveaway"] },
  { id: "engagement", title: "التصويتات والاقتراحات", command: "/poll · /pollend · /suggest", keywords: ["تصويت", "اقتراح", "poll", "suggestion"] },
  { id: "tickets", title: "تذاكر الدعم", command: "/ticketpanel · /ticketsummary", keywords: ["تذكرة", "دعم", "ticket"] },
  { id: "ticketManagement", title: "إدارة التذاكر القائمة", command: "/ticketclaim · /ticketclose", keywords: ["تذكرة", "مطالبة", "إغلاق", "ticket", "claim"] },
  { id: "shop", title: "متجر الرتب", command: "/shop · /buyrole", keywords: ["متجر", "رتبة", "رصيد", "shop", "role"] },
  { id: "streams", title: "إعلانات البث", command: "Webhook · اختبار إعلان", keywords: ["بث", "اعلان", "webhook", "stream"] },
];

export function filterCommunityProgramRows(query: string): CommunityProgramRow[] {
  const normalizedQuery = query.trim().toLocaleLowerCase("ar");
  if (!normalizedQuery) return communityProgramRows;
  return communityProgramRows.filter(row => [row.title, row.command, ...row.keywords]
    .some(value => value.toLocaleLowerCase("ar").includes(normalizedQuery)));
}
