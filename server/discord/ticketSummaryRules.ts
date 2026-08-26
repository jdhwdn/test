import { prepareTicketSummaryMetadata } from "./communityAssistant";

type TicketMetadata = { id: number; guildId: string; staffSummaryMetadata: string | null };

export function planTicketMetadataSummary(input: { ticket: TicketMetadata; requestedGuildId: string; suppliedMetadata?: string | null }) {
  const metadata = prepareTicketSummaryMetadata({ ticketGuildId: input.ticket.guildId, requestedGuildId: input.requestedGuildId, storedMetadata: input.ticket.staffSummaryMetadata, suppliedMetadata: input.suppliedMetadata?.trim() || undefined });
  if (!metadata) return { allowed: false as const, reason: "guild_scope_mismatch" as const };
  return { allowed: true as const, ticketId: input.ticket.id, metadata: metadata.metadata, shouldPersist: metadata.shouldPersist };
}
