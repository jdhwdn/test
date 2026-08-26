import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";

export function resolveMigrationsFolder(projectRoot = process.cwd()) {
  return resolve(projectRoot, "drizzle");
}

export async function applyDatabaseMigrationsAtStartup() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn("[Database] DATABASE_URL is not configured; skipping automatic migrations.");
    return { applied: false, reason: "missing_database_url" as const };
  }

  const migrationsFolder = resolveMigrationsFolder();
  if (!existsSync(migrationsFolder)) {
    throw new Error(`[Database] Drizzle migrations folder was not found at ${migrationsFolder}.`);
  }

  console.info("[Database] Applying pending Drizzle migrations before startup.");
  await migrate(drizzle(databaseUrl), { migrationsFolder });
  console.info("[Database] Drizzle migrations are up to date.");
  return { applied: true, reason: "applied" as const };
}
