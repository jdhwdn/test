export function normalizeXpAdjustment(value: number, limit = 1_000_000) {
  const safeLimit = Math.max(1, Math.floor(limit));
  const normalized = Math.trunc(Number.isFinite(value) ? value : 0);
  return Math.min(safeLimit, Math.max(-safeLimit, normalized));
}

export function canApplyXpAdjustment(value: number) {
  return value !== 0;
}
