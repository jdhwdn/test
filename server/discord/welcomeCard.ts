import { createCanvas, loadImage, type SKRSContext2D } from "@napi-rs/canvas";

export type WelcomeCardInput = {
  guildName: string;
  memberName: string;
  avatarUrl: string;
  message: string;
};

function cleanText(value: string, maximum: number) {
  return value.replace(/<@!?\d+>/g, "").replace(/\*|_|`|#/g, "").trim().slice(0, maximum);
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

function drawLantern(ctx: SKRSContext2D, x: number, y: number, scale: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = "rgba(154, 103, 35, 0.55)";
  ctx.fillStyle = "rgba(221, 173, 80, 0.16)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 24);
  ctx.stroke();
  roundedRect(ctx, -26, 24, 52, 78, 9);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-18, 42);
  ctx.lineTo(18, 42);
  ctx.moveTo(-18, 69);
  ctx.lineTo(18, 69);
  ctx.moveTo(0, 25);
  ctx.lineTo(0, 100);
  ctx.stroke();
  ctx.restore();
}

export async function createWelcomeCard(input: WelcomeCardInput) {
  const width = 1100;
  const height = 460;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, "#20180e");
  background.addColorStop(0.42, "#b78740");
  background.addColorStop(0.7, "#f4e7c9");
  background.addColorStop(1, "#d5aa62");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width * 0.62, height * 0.42, 10, width * 0.62, height * 0.42, 460);
  glow.addColorStop(0, "rgba(255,255,255,0.82)");
  glow.addColorStop(1, "rgba(251,230,191,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  roundedRect(ctx, 22, 22, width - 44, height - 44, 28);
  ctx.strokeStyle = "rgba(112, 69, 18, 0.85)";
  ctx.lineWidth = 4;
  ctx.stroke();
  roundedRect(ctx, 38, 38, width - 76, height - 76, 22);
  ctx.strokeStyle = "rgba(255, 247, 218, 0.85)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "rgba(65, 39, 15, 0.18)";
  for (let index = 0; index < 14; index += 1) {
    const x = 70 + index * 78;
    ctx.beginPath();
    ctx.arc(x, 72 + (index % 2) * 16, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  drawLantern(ctx, 100, 265, 1.15);
  drawLantern(ctx, 984, 242, 0.9);

  const avatarCenterX = 235;
  const avatarCenterY = 242;
  ctx.beginPath();
  ctx.arc(avatarCenterX, avatarCenterY, 118, 0, Math.PI * 2);
  ctx.fillStyle = "#5b3410";
  ctx.fill();
  ctx.lineWidth = 11;
  ctx.strokeStyle = "#f9e6b9";
  ctx.stroke();
  try {
    const avatarResponse = await fetch(input.avatarUrl);
    if (!avatarResponse.ok) throw new Error("Avatar fetch failed");
    const avatar = await loadImage(Buffer.from(await avatarResponse.arrayBuffer()));
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarCenterX, avatarCenterY, 105, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatar, avatarCenterX - 105, avatarCenterY - 105, 210, 210);
    ctx.restore();
  } catch {
    ctx.beginPath();
    ctx.arc(avatarCenterX, avatarCenterY, 104, 0, Math.PI * 2);
    ctx.fillStyle = "#312315";
    ctx.fill();
    ctx.fillStyle = "#f4ddb0";
    ctx.font = "700 72px DejaVu Sans, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(cleanText(input.memberName, 1).toUpperCase() || "?", avatarCenterX, avatarCenterY + 25);
  }

  ctx.fillStyle = "#73501c";
  ctx.font = "600 26px DejaVu Sans, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("أهلاً وسهلاً بك في", 676, 122);
  ctx.fillStyle = "#8b5f21";
  ctx.font = "800 64px DejaVu Sans, sans-serif";
  ctx.fillText(cleanText(input.guildName, 22), 676, 194);
  ctx.strokeStyle = "rgba(115, 80, 28, 0.7)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(460, 222);
  ctx.lineTo(892, 222);
  ctx.stroke();
  ctx.fillStyle = "#513614";
  ctx.font = "700 34px DejaVu Sans, sans-serif";
  ctx.fillText(cleanText(input.memberName, 28), 676, 285);
  ctx.fillStyle = "#755320";
  ctx.font = "500 19px DejaVu Sans, sans-serif";
  ctx.fillText(cleanText(input.message, 74) || "نتمنى لك وقتاً سعيداً معنا", 676, 337);
  ctx.font = "500 15px DejaVu Sans, sans-serif";
  ctx.fillStyle = "rgba(81,54,20,0.78)";
  ctx.fillText("MAJLSAWI • WELCOME", 676, 386);

  return canvas.toBuffer("image/png");
}
