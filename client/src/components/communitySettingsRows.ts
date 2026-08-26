export type CommunitySettingsRow = {
  id: "xp" | "safety" | "assistant" | "knowledge";
  title: string;
  command: string;
  keywords: string[];
};

export const communitySettingsRows: CommunitySettingsRow[] = [
  { id: "xp", title: "XP والمستويات والرتب", command: "/rank · /xptop", keywords: ["xp", "مستويات", "رتب", "leaderboard"] },
  { id: "safety", title: "الحماية التلقائية وAutoMod", command: "/warnings · /clean · /lock", keywords: ["حماية", "سبام", "رابط", "بوت", "ريد", "automod"] },
  { id: "assistant", title: "المساعد المحلي النصي", command: "/help · /faq · /complaint · /eventidea", keywords: ["مساعد", "قوانين", "ترجمة", "تذاكر", "ai"] },
  { id: "knowledge", title: "المعرفة المعتمدة", command: "/help · /faq", keywords: ["معرفة", "قوانين", "أسئلة", "faq"] },
];

export function filterCommunitySettingsRows(query: string): CommunitySettingsRow[] {
  const normalizedQuery = query.trim().toLocaleLowerCase("ar");
  if (!normalizedQuery) return communitySettingsRows;
  return communitySettingsRows.filter(row => [row.title, row.command, ...row.keywords]
    .some(value => value.toLocaleLowerCase("ar").includes(normalizedQuery)));
}
