export type AdminAssistantProposal =
  | { kind: "create_channel"; name: string; visibility: "public" | "private" }
  | { kind: "create_role"; name: string }
  | { kind: "create_jail_role"; roleName: string; allowedChannelName: string }
  | { kind: "update_channel_visibility"; channelName: string; visibility: "public" | "private" }
  | { kind: "refuse"; reason: string };

const blocked = /\b(delete|remove|destroy|nuke|administrator|admin\s*permission|webhook|integration|owner)\b|حذف|امسح|خرب|دمر|ادمن|أدمن|ويبهوك|تكامل|اونر|مالك/i;
const cleanName = (value: string) => value.trim().replace(/[^a-zA-Z0-9\u0600-\u06FF\s_-]/g, "").slice(0, 80);

export function parseAdminAssistantRequest(input: string): AdminAssistantProposal {
  const normalized = input.trim().replace(/\s+/g, " ");
  if (!normalized) return { kind: "refuse", reason: "اكتب اسم الروم أو الرتبة المطلوب." };
  if (blocked.test(normalized)) return { kind: "refuse", reason: "مساعد الإدارة لا ينفذ الحذف أو التخريب أو Administrator أو التكاملات." };
  const jailRole = normalized.match(/(?:سو|أنشئ|انشئ|انشى|انشاء|create|make)\s+(?:رتبة|رول|role)\s+(?:اسمها\s+)?(.+?)\s+(?:خاصه?|خاصة)\s+(?:بالسجن|للسجن)\s+(?:ما\s*يشوف|يشوف)\s+(?:إلا|الا|فقط|غير)\s+(?:روم|قناة|channel)\s+(.+)/i);
  if (jailRole) {
    const roleName = cleanName(jailRole[1]);
    const allowedChannelName = cleanName(jailRole[2]);
    return roleName && allowedChannelName
      ? { kind: "create_jail_role", roleName, allowedChannelName }
      : { kind: "refuse", reason: "اكتب اسم رتبة السجن واسم الروم المسموح بوضوح." };
  }
  const role = normalized.match(/(?:سو|أنشئ|انشئ|انشى|انشاء|create|make)\s+(?:رتبة|رول|role)\s+(?:اسمها\s+)?(.+)/i);
  if (role) {
    const name = cleanName(role[1]);
    return name ? { kind: "create_role", name } : { kind: "refuse", reason: "اسم الرتبة غير صالح." };
  }
  const channel = normalized.match(/(?:سو|أنشئ|انشئ|انشى|انشاء|create|make)\s+(?:روم|قناة|channel)\s+(.+)/i);
  if (channel) {
    const requested = channel[1]; const visibility = /خاص|برايفت|private|مخفي/i.test(requested) ? "private" : "public";
    const name = cleanName(requested.replace(/خاص|برايفت|private|مخفي|للكل|public/gi, ""));
    return name ? { kind: "create_channel", name, visibility } : { kind: "refuse", reason: "اسم الروم غير صالح." };
  }
  const visibility = normalized.match(/(?:خل|اجعل|عدل|modify|make)\s+(?:روم|قناة|channel)\s+(.+?)\s+(?:خاص|برايفت|private|مخفي|للكل|public)/i);
  if (visibility) return { kind: "update_channel_visibility", channelName: cleanName(visibility[1]), visibility: /خاص|برايفت|private|مخفي/i.test(normalized) ? "private" : "public" };
  return { kind: "refuse", reason: "حالياً أقدر أنشئ روم/رتبة، أو رتبة سجن لروم واحد، أو أغير ظهور روم فقط؛ وكلها تحتاج معاينة وتأكيد المدير." };
}
