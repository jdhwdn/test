export function formatXpProgress(xp: number, level: number) {
  const safeXp = Math.max(0, Math.floor(xp));
  const safeLevel = Math.max(0, Math.floor(level));
  const currentFloor = safeLevel ** 2 * 100;
  const nextFloor = (safeLevel + 1) ** 2 * 100;
  const span = Math.max(1, nextFloor - currentFloor);
  const completed = Math.min(span, Math.max(0, safeXp - currentFloor));
  const filled = Math.round((completed / span) * 10);
  return { currentFloor, nextFloor, bar: `${"▰".repeat(filled)}${"▱".repeat(10 - filled)}`, percent: Math.round((completed / span) * 100) };
}
