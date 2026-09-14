import { describe, expect, it } from "vitest";
import { formatSecurityEvent } from "@/lib/security-log";
import { buildCsp } from "@/lib/csp";

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

describe("buildCsp", () => {
  it("n'autorise que les scripts portant le nonce, jamais 'unsafe-inline' pour script-src", () => {
    const csp = buildCsp("abc123", false);
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(buildCsp("x", true)).toContain("'unsafe-eval'");
    expect(csp.split("script-src")[1]?.split(";")[0]).not.toContain(
      "unsafe-inline",
    );
  });
});
