import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export type StreamWebhookEvent = { title: string; url: string; eventId: string; thumbnailUrl: string | null };

export function createStreamWebhookSecret() {
  return randomBytes(32).toString("base64url");
}

export function hashStreamWebhookSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export function matchesStreamWebhookSecret(secret: string, storedHash: string) {
  const computed = Buffer.from(hashStreamWebhookSecret(secret), "hex");
  const stored = Buffer.from(storedHash, "hex");
  return computed.length === stored.length && timingSafeEqual(computed, stored);
}

function httpsUrl(value: unknown, required: boolean) {
  if (typeof value !== "string" || value.length > 1600) return required ? null : null;
  try { return new URL(value).protocol === "https:" ? value : null; } catch { return null; }
}

export function parseStreamWebhookEvent(payload: unknown): StreamWebhookEvent | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const input = payload as Record<string, unknown>;
  const title = typeof input.title === "string" ? input.title.trim().slice(0, 256) : "";
  const url = httpsUrl(input.url, true);
  if (!title || !url) return null;
  const suppliedEventId = typeof input.eventId === "string" ? input.eventId.trim().slice(0, 256) : "";
  const startedAt = typeof input.startedAt === "string" ? input.startedAt.trim().slice(0, 64) : "";
  const eventId = suppliedEventId || createHash("sha256").update(`${title}|${url}|${startedAt}`).digest("hex");
  return { title, url, eventId, thumbnailUrl: httpsUrl(input.thumbnailUrl, false) };
}

export function streamEventKeyHash(announcementId: number, eventId: string) {
  return createHash("sha256").update(`${announcementId}:${eventId}`).digest("hex");
}
