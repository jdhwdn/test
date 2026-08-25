export type VoicePermissionDecision =
  | { allowed: true }
  | { allowed: false; message: string };

export function assessBotVoicePermissions(input: { canConnect: boolean; canSpeak: boolean }): VoicePermissionDecision {
  if (!input.canConnect) return { allowed: false, message: "لا يملك مجلساوي صلاحية Connect في هذا الروم الصوتي." };
  if (!input.canSpeak) return { allowed: false, message: "لا يملك مجلساوي صلاحية Speak في هذا الروم الصوتي." };
  return { allowed: true };
}

export function assessVoiceCommandState(input: {
  authorized: boolean;
  requesterVoiceChannelId?: string | null;
  botVoiceChannelId?: string | null;
  action: "join" | "leave" | "say";
}): VoicePermissionDecision {
  if (!input.authorized) return { allowed: false, message: "ليس لديك الرتبة أو الصلاحية المضبوطة لهذا الأمر الصوتي." };
  if (input.action !== "leave" && !input.requesterVoiceChannelId) return { allowed: false, message: "ادخل روم صوتي أولاً." };
  if (input.action === "leave" && !input.botVoiceChannelId) return { allowed: false, message: "مجلساوي ليس متصلاً بروم صوتي." };
  if (input.action === "say" && input.requesterVoiceChannelId !== input.botVoiceChannelId) return { allowed: false, message: "يجب أن تكون في نفس روم مجلساوي عند استخدام /say." };
  return { allowed: true };
}
