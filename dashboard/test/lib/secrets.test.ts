import { describe, expect, it } from "vitest";
import {
  generateLinkToken,
  generateRecoveryCode,
  hashSecret,
  secretsMatch,
} from "@/lib/secrets";

describe("generateRecoveryCode", () => {
  it("donne six chiffres, zéros de tête compris, variés", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const code = generateRecoveryCode();
      expect(code).toMatch(/^\d{6}$/);
      codes.add(code);
    }
    expect(codes.size).toBeGreaterThan(150);
  });
});

describe("generateLinkToken", () => {
  it("donne un jeton base64url d'au moins 40 caractères, sans caractère d'URL", () => {
    const token = generateLinkToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(generateLinkToken()).not.toBe(token);
  });
});

describe("hashSecret / secretsMatch", () => {
  it("un HMAC déterministe par clé, différent d'une clé à l'autre", () => {
    const a = hashSecret("042917", "cle-serveur-1");
    expect(a).toBe(hashSecret("042917", "cle-serveur-1"));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(hashSecret("042917", "cle-serveur-2"));
    expect(a).not.toBe(hashSecret("042918", "cle-serveur-1"));
  });

  it("compare en temps constant, faux pour des longueurs différentes", () => {
    const a = hashSecret("x", "k");
    expect(secretsMatch(a, hashSecret("x", "k"))).toBe(true);
    expect(secretsMatch(a, hashSecret("y", "k"))).toBe(false);
    expect(secretsMatch(a, a.slice(1))).toBe(false);
  });
});
