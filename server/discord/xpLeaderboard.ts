export type XpLeaderboardEntry = { memberLabel: string; xp: number; level: number };

function safeLabel(label: string) {
  return label.replace(/[\r\n`*_~|]/g, " ").trim().slice(0, 48) || "عضو";
}

export function formatXpLeaderboard(entries: XpLeaderboardEntry[]) {
  if (!entries.length) return "لا توجد نقاط XP مسجلة بعد. تفاعل في السيرفر لتظهر هنا.";
  return entries.slice(0, 10).map((entry, index) => `**${index + 1}.** ${safeLabel(entry.memberLabel)} — المستوى **${Math.max(0, entry.level)}** · ${Math.max(0, entry.xp).toLocaleString("en-US")} XP`).join("\n");
}
