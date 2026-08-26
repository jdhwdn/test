import { MySqlDialect } from "drizzle-orm/mysql-core/dialect";
import { afterEach, describe, expect, it, vi } from "vitest";
import { saveWarningAppeal, setDbForTests } from "./db";

describe("saveWarningAppeal", () => {
  afterEach(() => setDbForTests(null));

  it("updates only one resolved, unappealed warning in the requested guild and member scope", async () => {
    const where = vi.fn().mockResolvedValue([{ affectedRows: 1 }]);
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });
    setDbForTests({ update } as any);

    const saved = await saveWarningAppeal({ guildId: "guild-a", memberId: "member-a", id: 27, note: "خاص" });

    expect(saved).toBe(true);
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ appealNote: "خاص", appealSubmittedAt: expect.any(Date) }));
    const condition = where.mock.calls[0]?.[0];
    const query = new MySqlDialect().sqlToQuery(condition);
    expect(query.sql).toContain("`warning_records`.`id` = ?");
    expect(query.sql).toContain("`warning_records`.`guildId` = ?");
    expect(query.sql).toContain("`warning_records`.`memberId` = ?");
    expect(query.sql).toContain("`warning_records`.`resolvedAt` is not null");
    expect(query.sql).toContain("`warning_records`.`appealSubmittedAt` is null");
    expect(query.params).toEqual([27, "guild-a", "member-a"]);
  });

  it("returns false when the scoped atomic update affects no warning", async () => {
    const where = vi.fn().mockResolvedValue([{ affectedRows: 0 }]);
    setDbForTests({ update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where }) }) } as any);

    await expect(saveWarningAppeal({ guildId: "guild-a", memberId: "member-a", id: 28, note: "خاص" })).resolves.toBe(false);
  });
});
