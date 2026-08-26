export function resolveWarningExpiry(now: Date, expiryDays: number) {
  const safeDays = Number.isInteger(expiryDays) && expiryDays >= 1 && expiryDays <= 365 ? expiryDays : 30;
  return new Date(now.getTime() + safeDays * 24 * 60 * 60 * 1000);
}
