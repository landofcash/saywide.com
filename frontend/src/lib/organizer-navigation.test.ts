import { describe, expect, it } from "vitest";
import { entryUrl, organizerDestination } from "./organizer-navigation";

describe("organizer destinations", () => {
  it("preserves known destinations through entry", () => {
    expect(entryUrl("/create")).toBe("/start?next=%2Fcreate");
    expect(organizerDestination("/surveys/abc-123/share")).toBe("/surveys/abc-123/share");
    expect(organizerDestination("/reports/abc-123")).toBe("/reports/abc-123");
  });
  it("rejects external, encoded, recursive and participant destinations", () => {
    for (const value of [null, "https://evil.example", "//evil.example", "/\\evil.example", "/%2f%2fevil.example", "/start", "/login", "/s/public-token", "/dashboard?next=https://evil.example"]) {
      expect(organizerDestination(value)).toBe("/dashboard");
    }
  });
});
