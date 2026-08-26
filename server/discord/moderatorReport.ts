export type ModeratorActionRecord = { executorId: string; executorLabel: string; action: string };

export function buildModeratorActivityRows(records: ModeratorActionRecord[]) {
  const totals: Record<string, { label: string; total: number; actions: Record<string, number> }> = {};
  for (const record of records) {
    const row = totals[record.executorId] ?? { label: record.executorLabel, total: 0, actions: {} };
    row.total += 1; row.actions[record.action] = (row.actions[record.action] ?? 0) + 1; totals[record.executorId] = row;
  }
  return Object.entries(totals).sort((left, right) => right[1].total - left[1].total).slice(0, 12).map(([id, summary]) => ({ id, label: summary.label, total: summary.total, actions: Object.entries(summary.actions) }));
}
