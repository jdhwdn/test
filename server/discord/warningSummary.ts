export type ActiveWarningEntry = { id: number; moderatorLabel: string; reason: string; createdAt: Date; expiresAt: Date | null };

function cleanText(value: string, limit: number) {
  return value.replace(/[\r\n`*_~|]/g, " ").replace(/<@!?\d+>|<@&\d+>|<#\d+>/g, "[mention]").trim().slice(0, limit) || "بدون سبب";
}

export function formatActiveWarnings(entries: ActiveWarningEntry[]) {
  if (!entries.length) return "لا توجد تحذيرات نشطة لهذا العضو.";
  return entries.slice(0, 10).map((entry, index) => {
    const expiry = entry.expiresAt ? `<t:${Math.floor(entry.expiresAt.getTime() / 1000)}:R>` : "بدون انتهاء";
    return `**${index + 1}.** ${cleanText(entry.reason, 110)}\nالمشرف: ${cleanText(entry.moderatorLabel, 48)} · ينتهي: ${expiry}`;
  }).join("\n\n");
}
