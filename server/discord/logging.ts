import { EmbedBuilder, type Guild, type TextChannel } from "discord.js";
import {
  createActivityLog,
  getLogRoute,
  type ActivityLogInput,
  type LogCategory,
} from "../db";

export type DiscordEntity = {
  id?: string | null;
  label?: string | null;
};

export type DiscordLogEvent = Omit<ActivityLogInput, "guildId" | "details" | "destinationChannelId"> & {
  guild: Guild;
  details?: Record<string, string | null | undefined>;
};

const CATEGORY_COLORS: Record<LogCategory, string> = {
  moderation: "#ED4245",
  voice: "#5865F2",
  members: "#57F287",
  roles: "#FEE75C",
  channels: "#EB459E",
  messages: "#FAA61A",
  xp: "#00D4AA",
  welcome: "#57F287",
  interactions: "#C9A7FF",
  system: "#99AAB5",
  community: "#3BA55D",
  tickets: "#5865F2",
  economy: "#F1C40F",
  ai: "#A970FF",
};

function displayEntity(entity: DiscordEntity) {
  if (!entity.id && !entity.label) return "System";
  return `${entity.label ?? "Unknown"}${entity.id ? `\n\`${entity.id}\`` : ""}`;
}

function compact(value: string, max = 940) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function buildLogEmbed(input: Omit<DiscordLogEvent, "guild">) {
  const fields = [] as { name: string; value: string; inline?: boolean }[];
  if (input.actorId || input.actorLabel) {
    fields.push({ name: "Executor", value: displayEntity({ id: input.actorId, label: input.actorLabel }), inline: true });
  }
  if (input.targetId || input.targetLabel) {
    fields.push({ name: "Affected member / item", value: displayEntity({ id: input.targetId, label: input.targetLabel }), inline: true });
  }
  if (input.reason) {
    fields.push({ name: "Reason", value: compact(input.reason), inline: false });
  }
  for (const [name, value] of Object.entries(input.details ?? {})) {
    if (!value) continue;
    fields.push({ name, value: compact(value), inline: fields.length < 5 });
  }

  return new EmbedBuilder()
    .setColor(Number.parseInt((input.accentColor || CATEGORY_COLORS[input.category]).replace("#", ""), 16))
    .setAuthor({ name: `${input.icon} مجلساوي • ${input.category.toUpperCase()} LOG` })
    .setTitle(input.title)
    .addFields(fields.slice(0, 25))
    .setTimestamp()
    .setFooter({ text: `Event: ${input.eventKey} • مجلساوي Logging` });
}

export async function logDiscordEvent(input: DiscordLogEvent) {
  const route = await getLogRoute(input.guild.id, input.category);
  const details = Object.fromEntries(
    Object.entries(input.details ?? {}).filter(([, value]) => value !== undefined && value !== null),
  ) as Record<string, string>;
  const stored: ActivityLogInput = {
    guildId: input.guild.id,
    category: input.category,
    eventKey: input.eventKey,
    title: input.title,
    accentColor: input.accentColor || CATEGORY_COLORS[input.category],
    icon: input.icon,
    actorId: input.actorId ?? null,
    actorLabel: input.actorLabel ?? null,
    targetId: input.targetId ?? null,
    targetLabel: input.targetLabel ?? null,
    reason: input.reason ?? null,
    details,
    destinationChannelId: route?.channelId ?? null,
  };

  await createActivityLog(stored);
  if (!route?.channelId) return;
  try {
    const channel = await input.guild.channels.fetch(route.channelId);
    if (!channel?.isTextBased()) return;
    await (channel as TextChannel).send({
      embeds: [buildLogEmbed(input)],
      allowedMentions: { parse: [] },
    });
  } catch (error) {
    console.warn(`[Discord] Unable to deliver ${input.category} log for ${input.guild.id}`, error);
  }
}

export { CATEGORY_COLORS };
