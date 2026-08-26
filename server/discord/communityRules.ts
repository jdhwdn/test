export type AutoModRuleInput = {
  type: "keyword" | "invite" | "caps" | "flood";
  pattern?: string | null;
  action: "delete" | "warn" | "mute" | "kick";
};

export type AutoModDecision = { matched: boolean; action?: AutoModRuleInput["action"]; reason?: string };

const URL_PATTERN = /(?:https?:\/\/|www\.)\S+/i;
const INVITE_PATTERN = /(?:discord(?:\.gg|\.com\/invite)\/)[a-z0-9-]+/i;

export function detectAutoModRule(content: string, rule: AutoModRuleInput): AutoModDecision {
  const trimmed = content.trim();
  if (rule.type === "invite" && INVITE_PATTERN.test(trimmed)) return { matched: true, action: rule.action, reason: "Discord invite detected" };
  if (rule.type === "keyword") {
    const keywords = (rule.pattern ?? "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
    const keyword = keywords.find(value => trimmed.toLowerCase().includes(value));
    return keyword ? { matched: true, action: rule.action, reason: `Blocked keyword: ${keyword}` } : { matched: false };
  }
  if (rule.type === "caps") {
    const letters = trimmed.replace(/[^A-Za-zأ-ي]/g, "");
    const upper = letters.replace(/[^A-Z]/g, "").length;
    return letters.length >= 12 && upper / letters.length >= 0.75 ? { matched: true, action: rule.action, reason: "Excessive capital letters" } : { matched: false };
  }
  return { matched: false };
}

export function detectLink(content: string) {
  return URL_PATTERN.test(content) || INVITE_PATTERN.test(content);
}

export function updateWindow(timestamps: number[], now: number, windowSeconds: number, limit: number) {
  const active = [...timestamps.filter(timestamp => now - timestamp <= windowSeconds * 1000), now];
  return { active, triggered: active.length >= limit };
}

export function renderLevelUpMessage(template: string | null | undefined, input: { user: string; level: number; xp: number }) {
  return (template || "مبروك {user}! وصلت للمستوى {level}.")
    .replaceAll("{user}", input.user)
    .replaceAll("{level}", String(input.level))
    .replaceAll("{xp}", String(input.xp));
}
