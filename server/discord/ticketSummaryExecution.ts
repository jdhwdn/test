import { planTicketMetadataSummary } from "./ticketSummaryRules";

export type TicketSummaryRecord = {
  id: number;
  guildId: string;
  openerLabel: string;
  status: "open" | "claimed" | "closed";
  createdAt: Date;
  closedAt: Date | null;
  staffSummaryMetadata: string | null;
  claimedById: string | null;
  closedById: string | null;
};

export async function executeTicketMetadataSummary(input: {
  ticketId: number;
  guildId: string;
  suppliedMetadata?: string | null;
  getTicket: (payload: { guildId: string; id: number }) => Promise<TicketSummaryRecord | undefined>;
  saveMetadata: (payload: { guildId: string; id: number; metadata: string | null }) => Promise<void>;
}) {
  const ticket = await input.getTicket({ guildId: input.guildId, id: input.ticketId });
  if (!ticket) return { allowed: false as const, reason: "not_found" as const };
  const plan = planTicketMetadataSummary({ ticket, requestedGuildId: input.guildId, suppliedMetadata: input.suppliedMetadata });
  if (!plan.allowed) return plan;
  if (plan.shouldPersist) await input.saveMetadata({ guildId: input.guildId, id: ticket.id, metadata: plan.metadata });
  return { allowed: true as const, ticket: { ...ticket, staffSummaryMetadata: plan.metadata }, persisted: plan.shouldPersist };
}
