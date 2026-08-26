import { describe, expect, it } from "vitest";
import { filterCommunityProgramRows } from "./communityProgramRows";

describe("community program row search", () => {
  it("returns all rows for an empty search", () => {
    expect(filterCommunityProgramRows("")).toHaveLength(7);
  });

  it("matches Arabic and command-label search terms", () => {
    expect(filterCommunityProgramRows("تذكرة").map(row => row.id)).toEqual(["tickets", "ticketManagement"]);
    expect(filterCommunityProgramRows("poll").map(row => row.id)).toEqual(["engagement"]);
    expect(filterCommunityProgramRows("webhook").map(row => row.id)).toEqual(["streams"]);
  });
});
