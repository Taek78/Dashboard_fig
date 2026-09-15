import { describe, expect, it } from "vitest";
import { parseEnv, productionProblems } from "@/lib/env-schema";

const base = {
  DATABASE_URL: "postgresql://fig:fig@localhost:5432/fig",
  AUTH_SECRET: "a".repeat(32),
};

describe("parseEnv", () => {
  it("exige une URL postgres et le secret, ignore les clés inconnues", () => {
    const env = parseEnv({ ...base, AUTRE: "x", DATA_SOURCE: "mock" });
    expect(env).toEqual(base);
    expect("AUTRE" in env).toBe(false);
    expect("DATA_SOURCE" in env).toBe(false);
    expect(() =>
      parseEnv({ ...base, DATABASE_URL: "postgres://u:p@h/db" }),
    ).not.toThrow();
  });

  it("refuse une base absente ou qui n'est pas PostgreSQL", () => {
    expect(() => parseEnv({ AUTH_SECRET: base.AUTH_SECRET })).toThrow();
    expect(() =>
      parseEnv({ ...base, DATABASE_URL: "mysql://u:p@h/db" }),
    ).toThrow();
  });

  it("borne le secret à 32 caractères", () => {
    expect(() => parseEnv({ ...base, AUTH_SECRET: "a".repeat(31) })).toThrow();
  });

  it("ne reflète ni le secret ni l'URL de la base dans l'erreur", () => {
    const secret = "S3cret-tres-court";
    try {
      parseEnv({
        DATABASE_URL: "mysql://fig:MotDePasseBase@h/db",
        AUTH_SECRET: secret,
      });
      expect.unreachable();
    } catch (error) {
      expect(String(error)).not.toContain(secret);
      expect(String(error)).not.toContain("MotDePasseBase");
    }
  });
});

describe("garde de production", () => {
  const prod = { NODE_ENV: "production", ...base };

  it("hors production, AUTH_URL n'est pas exigée", () => {
    expect(() => parseEnv({ NODE_ENV: "development", ...base })).not.toThrow();
  });

  it("en production, exige AUTH_URL", () => {
    expect(() => parseEnv(prod)).toThrow(/AUTH_URL/);
    expect(() => parseEnv(prod, { enforceProduction: false })).not.toThrow();
    expect(
      productionProblems(parseEnv(prod, { enforceProduction: false })),
    ).toHaveLength(1);
    expect(() =>
      parseEnv({ ...prod, AUTH_URL: "https://fig.example.invalid" }),
    ).not.toThrow();
  });
});
