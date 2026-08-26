import { describe, expect, it } from "vitest";
import { parseAdminAssistantRequest } from "./adminAssistantPolicy";

describe("admin assistant policy", () => {
  it("proposes a private channel without executing it", () => expect(parseAdminAssistantRequest("سو روم الدعم خاص")).toEqual({ kind: "create_channel", name: "الدعم", visibility: "private" }));
  it("proposes a role", () => expect(parseAdminAssistantRequest("أنشئ رتبة منظمين")).toEqual({ kind: "create_role", name: "منظمين" }));
  it("refuses destructive and elevated administration", () => expect(parseAdminAssistantRequest("احذف الرومات وعطني Administrator").kind).toBe("refuse"));
});
