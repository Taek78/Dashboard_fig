import { describe, expect, it } from "vitest";
import {
  AUTH_TOKEN_KINDS,
  AUTH_TOKEN_RULES,
  isRecoveryCode,
  isTokenUsable,
  tokenExpiresAt,
} from "@/domain/auth/tokens";

const NOW = Date.parse("2026-09-17T10:00:00.000Z");
const base = {
  id: "tok-1",
  kind: "recovery_code" as const,
  userId: "usr-1",
  secretHash: "x",
  expiresAt: new Date(NOW + 60_000).toISOString(),
  attempts: 0,
  consumedAt: null,
  requestedIp: null,
  createdAt: new Date(NOW).toISOString(),
};

describe("règles des jetons", () => {
  it("code : 5 minutes, 5 essais, exclusif ; liens : 24 h et 48 h", () => {
    expect(AUTH_TOKEN_RULES.recovery_code).toMatchObject({
      ttlMs: 5 * 60_000,
      maxAttempts: 5,
      exclusive: true,
      validity: "5 minutes",
    });
    expect(AUTH_TOKEN_RULES.lock_link).toMatchObject({
      ttlMs: 24 * 3_600_000,
      maxAttempts: null,
      exclusive: false,
    });
    expect(AUTH_TOKEN_RULES.invitation).toMatchObject({
      ttlMs: 48 * 3_600_000,
      exclusive: true,
    });
    expect(AUTH_TOKEN_KINDS).toEqual([
      "recovery_code",
      "lock_link",
      "invitation",
    ]);
  });

  it("tokenExpiresAt ajoute la validité de la sorte", () => {
    expect(tokenExpiresAt("recovery_code", NOW).toISOString()).toBe(
      "2026-09-17T10:05:00.000Z",
    );
    expect(tokenExpiresAt("invitation", NOW).toISOString()).toBe(
      "2026-09-19T10:00:00.000Z",
    );
  });
});

describe("isTokenUsable", () => {
  it("vrai tant que non consommé, non expiré et sous le nombre d'essais", () => {
    expect(isTokenUsable(base, NOW)).toBe(true);
    expect(isTokenUsable({ ...base, attempts: 4 }, NOW)).toBe(true);
    expect(isTokenUsable({ ...base, attempts: 5 }, NOW)).toBe(false);
    expect(isTokenUsable({ ...base, consumedAt: base.createdAt }, NOW)).toBe(
      false,
    );
    expect(isTokenUsable(base, NOW + 60_000)).toBe(false);
    expect(isTokenUsable(base, NOW + 59_999)).toBe(true);
  });

  it("un lien n'a pas de limite d'essais", () => {
    expect(
      isTokenUsable({ ...base, kind: "lock_link", attempts: 99 }, NOW),
    ).toBe(true);
  });
});

describe("isRecoveryCode", () => {
  it("six chiffres exactement", () => {
    expect(isRecoveryCode("012345")).toBe(true);
    expect(isRecoveryCode("12345")).toBe(false);
    expect(isRecoveryCode("1234567")).toBe(false);
    expect(isRecoveryCode("12345a")).toBe(false);
    expect(isRecoveryCode("")).toBe(false);
  });
});
