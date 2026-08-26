import { describe, expect, it } from "vitest";
import { filterCommunitySettingsRows } from "./communitySettingsRows";

describe("community settings row search", () => {
  it("lists every settings row when the query is empty", () => {
    expect(filterCommunitySettingsRows("")).toHaveLength(4);
  });

  it("matches Arabic labels and slash commands", () => {
    expect(filterCommunitySettingsRows("حماية").map(row => row.id)).toEqual(["safety"]);
    expect(filterCommunitySettingsRows("/faq").map(row => row.id)).toEqual(["assistant", "knowledge"]);
  });
});
