import type { Request, Response } from "express";
import { claimStreamAnnouncementDelivery, getStreamAnnouncementById, releaseStreamAnnouncementDelivery } from "./db";
import { sendStreamAnnouncement } from "./discord/bot";
import { matchesStreamWebhookSecret, parseStreamWebhookEvent, streamEventKeyHash } from "./streamAnnouncementRules";

const requestWindows = new Map<number, number[]>();

function allowRequest(announcementId: number) {
  const now = Date.now();
  const active = (requestWindows.get(announcementId) ?? []).filter(time => now - time < 60_000);
  if (active.length >= 12) return false;
  active.push(now);
  requestWindows.set(announcementId, active);
  return true;
}

export async function receiveStreamWebhook(req: Request, res: Response) {
  const announcementId = Number(req.params.announcementId);
  const secret = req.params.secret;
  if (!Number.isSafeInteger(announcementId) || announcementId < 1 || !secret || secret.length > 128) return res.status(404).json({ ok: false });
  try {
    const announcement = await getStreamAnnouncementById(announcementId);
    if (!announcement || !announcement.enabled || !matchesStreamWebhookSecret(secret, announcement.secretHash)) return res.status(404).json({ ok: false });
    if (!allowRequest(announcementId)) return res.status(429).json({ ok: false, error: "rate_limited" });
    const event = parseStreamWebhookEvent(req.body);
    if (!event) return res.status(400).json({ ok: false, error: "expected_https_title_url" });
    const eventKeyHash = streamEventKeyHash(announcementId, event.eventId);
    const claimed = await claimStreamAnnouncementDelivery({ announcementId, eventKeyHash });
    if (!claimed) return res.status(202).json({ ok: true, duplicate: true });
    try {
      await sendStreamAnnouncement({ guildId: announcement.guildId, destinationChannelId: announcement.destinationChannelId, mentionRoleId: announcement.mentionRoleId, sourceLabel: announcement.sourceLabel, sourceUrl: announcement.sourceUrl, messageTemplate: announcement.messageTemplate, title: event.title, streamUrl: event.url, thumbnailUrl: event.thumbnailUrl });
      return res.status(202).json({ ok: true });
    } catch (error) {
      await releaseStreamAnnouncementDelivery({ announcementId, eventKeyHash });
      console.error("[Stream webhook] Discord delivery failed", error instanceof Error ? error.message : "unknown");
      return res.status(502).json({ ok: false, error: "delivery_failed" });
    }
  } catch (error) {
    console.error("[Stream webhook] Processing failed", error instanceof Error ? error.message : "unknown");
    return res.status(500).json({ ok: false, error: "processing_failed" });
  }
}
