export function buildMemberCountChannelName(memberCount: number) {
  return `👥 الأعضاء: ${Math.max(0, Math.floor(memberCount)).toLocaleString("en-US")}`.slice(0, 100);
}

export function canUpdateMemberCounter(input: { channelExists: boolean; channelManageable: boolean }) {
  return input.channelExists && input.channelManageable;
}
