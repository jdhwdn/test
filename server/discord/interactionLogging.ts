export type InteractionLogKind = "slash_command" | "text_dashboard" | "mention" | "button" | "voice_action";

export function buildInteractionLogDetails(input: {
  kind: InteractionLogKind;
  channelId?: string | null;
  command?: string | null;
  outcome?: "received" | "completed" | "rejected" | "blocked" | "failed";
  policy?: "safe_voice_only" | "administrative_or_destructive" | null;
}) {
  return {
    "Interaction": input.kind.replaceAll("_", " "),
    "Command / action": input.command ?? "Not retained",
    "Channel": input.channelId ? `<#${input.channelId}>` : "Direct or unavailable",
    "Outcome": input.outcome ?? "received",
    "Privacy": "Raw message text and voice audio are not stored",
    ...(input.policy ? { "Safety policy": input.policy.replaceAll("_", " ") } : {}),
  };
}
