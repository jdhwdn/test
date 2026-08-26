export type WelcomeCardConfig = {
  heading: string;
  subheading: string;
  memberLine: string;
  accentColor: string;
  backgroundColor: string;
  backgroundPreset: "aurora" | "midnight" | "royal" | "ember";
  avatarShape: "circle" | "rounded";
  avatarSize: number;
  headingSize: number;
  subheadingSize: number;
  headingFont: "sans" | "serif";
  bodyFont: "sans" | "serif";
  contentOffsetY: number;
  backgroundImageUrl: string | null;
  logoUrl: string | null;
};

export const defaultWelcomeCardConfig: WelcomeCardConfig = {
  heading: "ياهلا {user}",
  subheading: "نورت مجتمع {server}",
  memberLine: "أنت العضو #{memberCount}",
  accentColor: "#8B5CF6",
  backgroundColor: "#111827",
  backgroundPreset: "aurora",
  avatarShape: "circle",
  avatarSize: 132,
  headingSize: 46,
  subheadingSize: 24,
  headingFont: "sans",
  bodyFont: "sans",
  contentOffsetY: 0,
  backgroundImageUrl: null,
  logoUrl: null,
};

const color = (value: unknown, fallback: string) => typeof value === "string" && /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(value) ? value : fallback;
const text = (value: unknown, fallback: string, max: number) => typeof value === "string" ? value.trim().slice(0, max) || fallback : fallback;
const integer = (value: unknown, fallback: number, min: number, max: number) => typeof value === "number" && Number.isFinite(value) ? Math.round(Math.min(max, Math.max(min, value))) : fallback;
const httpsUrl = (value: unknown) => {
  if (typeof value !== "string" || value.length > 1000) return null;
  try { return new URL(value).protocol === "https:" ? value : null; } catch { return null; }
};

export function sanitizeWelcomeCardConfig(raw: string | null | undefined): WelcomeCardConfig {
  let source: Record<string, unknown> = {};
  try { source = raw ? JSON.parse(raw) as Record<string, unknown> : {}; } catch { source = {}; }
  return {
    heading: text(source.heading, defaultWelcomeCardConfig.heading, 120),
    subheading: text(source.subheading, defaultWelcomeCardConfig.subheading, 180),
    memberLine: text(source.memberLine, defaultWelcomeCardConfig.memberLine, 120),
    accentColor: color(source.accentColor, defaultWelcomeCardConfig.accentColor),
    backgroundColor: color(source.backgroundColor, defaultWelcomeCardConfig.backgroundColor),
    backgroundPreset: source.backgroundPreset === "midnight" || source.backgroundPreset === "royal" || source.backgroundPreset === "ember" ? source.backgroundPreset : "aurora",
    avatarShape: source.avatarShape === "rounded" ? "rounded" : "circle",
    avatarSize: integer(source.avatarSize, defaultWelcomeCardConfig.avatarSize, 72, 180),
    headingSize: integer(source.headingSize, defaultWelcomeCardConfig.headingSize, 24, 72),
    subheadingSize: integer(source.subheadingSize, defaultWelcomeCardConfig.subheadingSize, 14, 42),
    headingFont: source.headingFont === "serif" ? "serif" : "sans",
    bodyFont: source.bodyFont === "serif" ? "serif" : "sans",
    contentOffsetY: integer(source.contentOffsetY, defaultWelcomeCardConfig.contentOffsetY, -100, 100),
    backgroundImageUrl: httpsUrl(source.backgroundImageUrl),
    logoUrl: httpsUrl(source.logoUrl),
  };
}

export function stringifyWelcomeCardConfig(raw: string | null | undefined) {
  return JSON.stringify(sanitizeWelcomeCardConfig(raw));
}
