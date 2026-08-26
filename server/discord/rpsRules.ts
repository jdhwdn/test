export const rpsChoices = ["rock", "paper", "scissors"] as const;
export type RpsChoice = (typeof rpsChoices)[number];

export function resolveRps(player: RpsChoice, bot: RpsChoice) {
  if (player === bot) return "draw" as const;
  if ((player === "rock" && bot === "scissors") || (player === "paper" && bot === "rock") || (player === "scissors" && bot === "paper")) return "win" as const;
  return "lose" as const;
}

export function canPlayRps(lastPlayedAt: number | undefined, now: number, cooldownMs = 30_000) {
  return !lastPlayedAt || now - lastPlayedAt >= cooldownMs;
}
