import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("migration 0016", () => {
  it("uses standard MySQL ALTER TABLE syntax for the two warning-appeal columns", () => {
    const sql = readFileSync(resolve(process.cwd(), "drizzle/0016_cute_titanium_man.sql"), "utf8");
    expect(sql).toContain("ALTER TABLE `warning_records` ADD `appealNote` varchar(600);");
    expect(sql).toContain("ALTER TABLE `warning_records` ADD `appealSubmittedAt` timestamp;");
    expect(sql).not.toMatch(/IF\s+NOT\s+EXISTS/i);
  });
});
