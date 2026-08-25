import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const migrationMocks = vi.hoisted(() => ({
  existsSync: vi.fn(),
  drizzle: vi.fn(),
  migrate: vi.fn(),
}));

vi.mock("node:fs", async importOriginal => ({
  ...(await importOriginal<typeof import("node:fs")>()),
  existsSync: migrationMocks.existsSync,
}));
vi.mock("drizzle-orm/mysql2", () => ({ drizzle: migrationMocks.drizzle }));
vi.mock("drizzle-orm/mysql2/migrator", () => ({ migrate: migrationMocks.migrate }));

import { applyDatabaseMigrationsAtStartup, resolveMigrationsFolder } from "./migrations";

describe("startup migrations", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    migrationMocks.existsSync.mockReturnValue(true);
    migrationMocks.drizzle.mockReturnValue({ connection: "test" });
    migrationMocks.migrate.mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  });

  it("resolves the repository drizzle directory from the process root", () => {
    expect(resolveMigrationsFolder("/app")).toBe("/app/drizzle");
  });

  it("skips safely when DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL;
    await expect(applyDatabaseMigrationsAtStartup()).resolves.toEqual({ applied: false, reason: "missing_database_url" });
    expect(migrationMocks.drizzle).not.toHaveBeenCalled();
    expect(migrationMocks.migrate).not.toHaveBeenCalled();
  });

  it("runs Drizzle migrator when DATABASE_URL and the migrations folder are available", async () => {
    process.env.DATABASE_URL = "mysql://user:pass@mysql/database";
    await expect(applyDatabaseMigrationsAtStartup()).resolves.toEqual({ applied: true, reason: "applied" });
    expect(migrationMocks.drizzle).toHaveBeenCalledWith("mysql://user:pass@mysql/database");
    expect(migrationMocks.migrate).toHaveBeenCalledWith({ connection: "test" }, { migrationsFolder: resolveMigrationsFolder() });
  });
});
