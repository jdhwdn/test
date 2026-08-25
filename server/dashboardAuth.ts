import type { Request } from "express";
import { parse } from "cookie";
import { jwtVerify, SignJWT } from "jose";
import { timingSafeEqual } from "node:crypto";
import type { User } from "../drizzle/schema";

export const DASHBOARD_SESSION_COOKIE = "discord_guardian_dashboard";
const SESSION_DURATION = "12h";

function secretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET must be configured for dashboard sessions.");
  return new TextEncoder().encode(secret);
}

export function validateDashboardPassword(candidate: string) {
  const configured = process.env.DASHBOARD_PASSWORD;
  if (!configured || !candidate) return false;
  const configuredBytes = Buffer.from(configured, "utf8");
  const candidateBytes = Buffer.from(candidate, "utf8");
  if (configuredBytes.length !== candidateBytes.length) return false;
  return timingSafeEqual(configuredBytes, candidateBytes);
}

export async function createDashboardSession() {
  return new SignJWT({ dashboard: true, role: "admin" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION)
    .sign(secretKey());
}

export function dashboardAdminUser(): User {
  const now = new Date();
  return {
    id: 0,
    openId: "dashboard_local_admin",
    name: "مدير مجلساوي",
    email: null,
    loginMethod: "dashboard-password",
    role: "admin",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  };
}

export async function getDashboardSessionUser(req: Request): Promise<User | null> {
  const token = parse(req.headers.cookie ?? "")[DASHBOARD_SESSION_COOKIE];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (payload.dashboard !== true || payload.role !== "admin") return null;
    return dashboardAdminUser();
  } catch {
    return null;
  }
}
