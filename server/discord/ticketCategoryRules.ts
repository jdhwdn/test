export function canManageTicketCategory(input: { isCategory: boolean; botCanView: boolean; botCanManageChannels: boolean }) {
  return input.isCategory && input.botCanView && input.botCanManageChannels;
}

export function isValidTicketCategorySelection(categoryIds: string[], selectedId: string | null | undefined) {
  return !selectedId || categoryIds.includes(selectedId);
}
