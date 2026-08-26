import { expect, it } from "vitest";

it("uses a non-empty Arabic title for the Majlsawi dashboard", () => {
  expect(process.env.VITE_APP_TITLE?.trim()).toBe("مجلساوي");
});
