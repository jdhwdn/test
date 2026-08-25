export const SAFE_AI_ACTIONS = ["mute", "unmute", "deafen", "undeafen", "move"] as const;

export type SafeAiAction = (typeof SAFE_AI_ACTIONS)[number];

export type AiActionProposal = {
  action: string;
  targetMemberId?: string;
  destinationChannelId?: string;
};

export type AiActionDecision =
  | { allowed: true; action: SafeAiAction; targetMemberId: string; destinationChannelId?: string }
  | { allowed: false; reason: "not_allowlisted" | "missing_target" | "missing_destination" };

export type MentionIntent = "blocked" | "voice_request" | "no_action";

const BLOCKED_PATTERNS = [
  /\b(delete|remove|destroy|nuke|ban|kick|timeout|create channel|delete channel|delete role|manage server)\b/i,
  /(حذف|امسح|خرب|تخريب|دمر|طرد|ابند|باند|حظر)/i,
  /(?:انشئ|أنشئ|غير|غيّر|عدل|عدّل|احذف|امسح).{0,24}(?:روم|قناة|رتبة|سيرفر)/i,
  /(?:روم|قناة|رتبة|سيرفر).{0,24}(?:انشئ|أنشئ|غير|غيّر|عدل|عدّل|احذف|امسح)/i,
];

const VOICE_PATTERNS = [
  /\b(mute|unmute|deafen|undeafen|move|pull)\b/i,
  /(ميوت|كتم|فك الميوت|ديفن|فك الديفن|انقل|نقل|اسحب)/i,
];

export function authorizeAiAction(proposal: AiActionProposal): AiActionDecision {
  if (!SAFE_AI_ACTIONS.includes(proposal.action as SafeAiAction)) return { allowed: false, reason: "not_allowlisted" };
  if (!proposal.targetMemberId) return { allowed: false, reason: "missing_target" };
  if (proposal.action === "move" && !proposal.destinationChannelId) return { allowed: false, reason: "missing_destination" };
  return {
    allowed: true,
    action: proposal.action as SafeAiAction,
    targetMemberId: proposal.targetMemberId,
    ...(proposal.destinationChannelId ? { destinationChannelId: proposal.destinationChannelId } : {}),
  };
}

export function classifyMentionIntent(content: string): MentionIntent {
  if (BLOCKED_PATTERNS.some(pattern => pattern.test(content))) return "blocked";
  if (VOICE_PATTERNS.some(pattern => pattern.test(content))) return "voice_request";
  return "no_action";
}

export function buildAiPolicyLogDetails(input: { intent: MentionIntent; action?: SafeAiAction; reason?: string }) {
  if (input.intent === "blocked") {
    return {
      "Policy outcome": "Rejected before execution",
      "Allowed scope": "Voice mute, unmute, deafen, undeafen, and move only",
      "Request content": "Not retained in logs",
      "Reason": input.reason ?? "Administrative or destructive request",
    };
  }
  return {
    "Policy outcome": input.intent === "voice_request" ? "Voice request detected; structured authorization required" : "No executable request",
    "Allowed scope": "Voice mute, unmute, deafen, undeafen, and move only",
    "Action": input.action ?? "None",
    "Request content": "Not retained in logs",
  };
}
