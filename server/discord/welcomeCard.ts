import { createCanvas, loadImage, type SKRSContext2D } from "@napi-rs/canvas";
import { sanitizeWelcomeCardConfig } from "./welcomeCardConfig";

export type WelcomeCardInput = {
  guildName: string;
  memberName: string;
  avatarUrl: string;
  message: string;
  memberCount?: number;
  cardConfig?: string | null;
};

function cleanText(value: string, maximum: number) {
  return value.replace(/<@!?\d+>/g, "").replace(/\*|_|`|#/g, "").trim().slice(0, maximum);
}

function replaceTokens(value: string, input: WelcomeCardInput) {
  return cleanText(value, 180)
    .replaceAll("{user}", cleanText(input.memberName, 28))
    .replaceAll("{server}", cleanText(input.guildName, 28))
    .replaceAll("{memberCount}", String(input.memberCount ?? "—"));
}

function roundedRect(ctx: SKRSContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function paintBackground(ctx: SKRSContext2D, width: number, height: number, color: string, preset: string) {
  const gradients: Record<string, [string, string, string]> = {
    aurora: [color, "#0B1220", "#1D4ED8"],
    midnight: [color, "#09090B", "#27272A"],
    royal: [color, "#1E1B4B", "#4C1D95"],
    ember: [color, "#24120B", "#9A3412"],
  };
  const [start, middle, end] = gradients[preset] ?? gradients.aurora;
  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, start);
  background.addColorStop(0.48, middle);
  background.addColorStop(1, end);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  const glow = ctx.createRadialGradient(width * 0.75, height * 0.25, 10, width * 0.75, height * 0.25, width * 0.6);
  glow.addColorStop(0, "rgba(255,255,255,0.20)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
}

async function loadRemoteImage(url: string | null) {
  if (!url) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) return null;
    return loadImage(Buffer.from(await response.arrayBuffer()));
  } catch { return null; }
}

export async function createWelcomeCard(input: WelcomeCardInput) {
  const config = sanitizeWelcomeCardConfig(input.cardConfig);
  const headingFont = config.headingFont === "serif" ? "DejaVu Serif, serif" : "DejaVu Sans, sans-serif";
  const bodyFont = config.bodyFont === "serif" ? "DejaVu Serif, serif" : "DejaVu Sans, sans-serif";
  const width = 1100;
  const height = 520;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  paintBackground(ctx, width, height, config.backgroundColor, config.backgroundPreset);

  const backgroundImage = await loadRemoteImage(config.backgroundImageUrl);
  if (backgroundImage) {
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.drawImage(backgroundImage, 0, 0, width, height);
    ctx.restore();
  }

  roundedRect(ctx, 24, 24, width - 48, height - 48, 30);
  ctx.fillStyle = "rgba(5, 9, 20, 0.26)";
  ctx.fill();
  ctx.strokeStyle = `${config.accentColor}CC`;
  ctx.lineWidth = 3;
  ctx.stroke();
  roundedRect(ctx, 40, 40, width - 80, height - 80, 22);
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.06)";
  for (let index = 0; index < 12; index += 1) {
    ctx.beginPath();
    ctx.arc(72 + index * 86, 86 + (index % 2) * 18, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  const avatarCenterX = 210;
  const avatarCenterY = 260;
  const avatarRadius = config.avatarSize / 2;
  ctx.save();
  if (config.avatarShape === "rounded") roundedRect(ctx, avatarCenterX - avatarRadius, avatarCenterY - avatarRadius, config.avatarSize, config.avatarSize, 26);
  else { ctx.beginPath(); ctx.arc(avatarCenterX, avatarCenterY, avatarRadius, 0, Math.PI * 2); }
  ctx.fillStyle = config.accentColor;
  ctx.fill();
  ctx.restore();

  const avatar = await loadRemoteImage(input.avatarUrl);
  ctx.save();
  if (config.avatarShape === "rounded") roundedRect(ctx, avatarCenterX - avatarRadius + 7, avatarCenterY - avatarRadius + 7, config.avatarSize - 14, config.avatarSize - 14, 21);
  else { ctx.beginPath(); ctx.arc(avatarCenterX, avatarCenterY, avatarRadius - 7, 0, Math.PI * 2); }
  ctx.clip();
  if (avatar) ctx.drawImage(avatar, avatarCenterX - avatarRadius + 7, avatarCenterY - avatarRadius + 7, config.avatarSize - 14, config.avatarSize - 14);
  else {
    ctx.fillStyle = "#172033";
    ctx.fillRect(avatarCenterX - avatarRadius, avatarCenterY - avatarRadius, config.avatarSize, config.avatarSize);
    ctx.fillStyle = "white";
    ctx.font = `800 ${Math.round(config.avatarSize * 0.44)}px ${headingFont}`;
    ctx.textAlign = "center";
    ctx.fillText(cleanText(input.memberName, 1).toUpperCase() || "?", avatarCenterX, avatarCenterY + config.avatarSize * 0.16);
  }
  ctx.restore();

  const contentX = 640;
  const y = config.contentOffsetY;
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.font = `600 ${config.subheadingSize}px ${bodyFont}`;
  ctx.fillText(replaceTokens(config.subheading, input), contentX, 150 + y);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `800 ${config.headingSize}px ${headingFont}`;
  ctx.fillText(replaceTokens(config.heading, input), contentX, 225 + y);
  ctx.strokeStyle = `${config.accentColor}CC`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(420, 258 + y);
  ctx.lineTo(860, 258 + y);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = `700 30px ${headingFont}`;
  ctx.fillText(cleanText(input.memberName, 30), contentX, 315 + y);
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = `500 20px ${bodyFont}`;
  ctx.fillText(replaceTokens(config.memberLine, input), contentX, 356 + y);
  ctx.fillStyle = `${config.accentColor}E6`;
  ctx.font = `600 15px ${bodyFont}`;
  ctx.fillText(cleanText(input.message, 92) || "نتمنى لك وقتاً سعيداً معنا", contentX, 402 + y);

  const logo = await loadRemoteImage(config.logoUrl);
  if (logo) ctx.drawImage(logo, 64, 64, 46, 46);
  else {
    ctx.fillStyle = config.accentColor;
    roundedRect(ctx, 64, 64, 46, 46, 12);
    ctx.fill();
    ctx.fillStyle = "white";
    ctx.font = `800 20px ${headingFont}`;
    ctx.textAlign = "center";
    ctx.fillText("م", 87, 94);
  }

  return canvas.toBuffer("image/png");
}
