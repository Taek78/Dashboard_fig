import { describe, expect, it } from "vitest";
import { parseEnv, productionProblems } from "@/lib/env-schema";

const auth = {
  AUTH_SECRET: "a".repeat(32),
  AUTH_BOOTSTRAP_EMAIL: "admin@example.invalid",
  AUTH_BOOTSTRAP_PASSWORD: "x".repeat(12),
};

describe("parseEnv", () => {
  it("en mock, n'exige pas DATABASE_URL et ignore les clés inconnues", () => {
    const env = parseEnv({ DATA_SOURCE: "mock", ...auth, AUTRE: "x" });
    expect(env).toEqual({
      DATA_SOURCE: "mock",
      ...auth,
      AUTH_BOOTSTRAP_NAME: "Administrateur",
    });
    expect("AUTRE" in env).toBe(false);
  });

  it("en db, exige une URL postgres", () => {
    expect(
      parseEnv({
        DATA_SOURCE: "db",
        DATABASE_URL: "postgresql://fig:fig@localhost:5432/fig",
        ...auth,
      }).DATA_SOURCE,
    ).toBe("db");
    expect(() =>
      parseEnv({
        DATA_SOURCE: "db",
        DATABASE_URL: "postgres://u:p@h/db",
        ...auth,
      }),
    ).not.toThrow();
    expect(() => parseEnv({ DATA_SOURCE: "db", ...auth })).toThrow();
    expect(() =>
      parseEnv({
        DATA_SOURCE: "db",
        DATABASE_URL: "mysql://u:p@h/db",
        ...auth,
      }),
    ).toThrow();
  });

  it("refuse DATA_SOURCE absent ou inconnu", () => {
    expect(() => parseEnv({ ...auth })).toThrow();
    expect(() => parseEnv({ DATA_SOURCE: "csv", ...auth })).toThrow();
  });

  it("borne le secret à 32 caractères et le mot de passe à 12", () => {
    expect(() =>
      parseEnv({ DATA_SOURCE: "mock", ...auth, AUTH_SECRET: "a".repeat(31) }),
    ).toThrow();
    expect(() =>
      parseEnv({
        DATA_SOURCE: "mock",
        ...auth,
        AUTH_BOOTSTRAP_PASSWORD: "x".repeat(11),
      }),
    ).toThrow();
    expect(() =>
      parseEnv({
        DATA_SOURCE: "mock",
        ...auth,
        AUTH_BOOTSTRAP_EMAIL: "pas-un-email",
      }),
    ).toThrow();
  });

  it("ne reflète pas la valeur du secret dans l'erreur", () => {
    const secret = "S3cret-tres-court";
    try {
      parseEnv({ DATA_SOURCE: "mock", ...auth, AUTH_SECRET: secret });
      expect.unreachable();
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
  });
});

describe("gardes de production", () => {
  const prod = { NODE_ENV: "production", DATA_SOURCE: "mock", ...auth };

  it("hors production, aucune variable supplémentaire n'est exigée", () => {
    expect(() =>
      parseEnv({ NODE_ENV: "development", DATA_SOURCE: "mock", ...auth }),
    ).not.toThrow();
  });

  it("en production, exige AUTH_URL et refuse fixtures et compte d'amorçage sans dérogation", () => {
    expect(() => parseEnv(prod)).toThrow(
      /AUTH_URL[\s\S]*fixtures[\s\S]*amorçage/,
    );
    expect(() => parseEnv(prod, { enforceProduction: false })).not.toThrow();
    expect(
      productionProblems(parseEnv(prod, { enforceProduction: false })),
    ).toHaveLength(3);
    expect(() =>
      parseEnv({ ...prod, AUTH_URL: "https://fig.example.invalid" }),
    ).toThrow();
    expect(() =>
      parseEnv({
        ...prod,
        AUTH_URL: "https://fig.example.invalid",
        ALLOW_MOCK_IN_PRODUCTION: "1",
      }),
    ).toThrow();
    expect(() =>
      parseEnv({
        ...prod,
        AUTH_URL: "https://fig.example.invalid",
        ALLOW_MOCK_IN_PRODUCTION: "1",
        AUTH_ALLOW_BOOTSTRAP: "1",
      }),
    ).not.toThrow();
    // En mode db, les comptes sont en table : pas de dérogation d'amorçage requise.
    expect(() =>
      parseEnv({
        NODE_ENV: "production",
        DATA_SOURCE: "db",
        DATABASE_URL: "postgresql://u:p@h/db",
        AUTH_URL: "https://fig.example.invalid",
        ...auth,
      }),
    ).not.toThrow();
  });
});

describe("compte gestionnaire", () => {
  it("accepte les deux variables ensemble, refuse l'une sans l'autre", () => {
    expect(() =>
      parseEnv({
        DATA_SOURCE: "mock",
        ...auth,
        AUTH_MANAGER_EMAIL: "gestion@example.invalid",
        AUTH_MANAGER_PASSWORD: "y".repeat(12),
      }),
    ).not.toThrow();
    expect(() =>
      parseEnv({
        DATA_SOURCE: "mock",
        ...auth,
        AUTH_MANAGER_EMAIL: "gestion@example.invalid",
      }),
    ).toThrow();
    expect(() =>
      parseEnv({
        DATA_SOURCE: "mock",
        ...auth,
        AUTH_MANAGER_EMAIL: "gestion@example.invalid",
        AUTH_MANAGER_PASSWORD: "court",
      }),
    ).toThrow();
  });
});
