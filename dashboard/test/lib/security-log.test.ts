import { describe, expect, it } from "vitest";
import { formatSecurityEvent } from "@/lib/security-log";

describe("formatSecurityEvent", () => {
  it("produit une ligne JSON horodatée avec le type et les champs de l'événement", () => {
    const line = formatSecurityEvent(
      { type: "login_failure", email: "a@b.invalid", ip: "203.0.113.5" },
      new Date("2026-09-14T08:00:00.000Z"),
    );
    expect(JSON.parse(line)).toEqual({
      ts: "2026-09-14T08:00:00.000Z",
      kind: "security",
      type: "login_failure",
      email: "a@b.invalid",
      ip: "203.0.113.5",
    });
    expect(line).not.toContain("\n");
  });
});
