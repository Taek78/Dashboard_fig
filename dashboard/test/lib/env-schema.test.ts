import { describe, expect, it } from "vitest";
import {
  mailTransportOf,
  parseEnv,
  productionProblems,
} from "@/lib/env-schema";

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

  const mailed = {
    MAIL_TRANSPORT: "brevo",
    MAIL_API_KEY: "xkeysib-test",
    MAIL_FROM: "noreply@fig.example.invalid",
  };
  const health = { HEALTH_TOKEN: "jeton-de-sante-0123456789" };

  it("en production, exige AUTH_URL", () => {
    expect(() => parseEnv(prod)).toThrow(/AUTH_URL/);
    expect(() => parseEnv(prod, { enforceProduction: false })).not.toThrow();
    expect(
      productionProblems(parseEnv(prod, { enforceProduction: false })),
    ).toHaveLength(3);
    expect(() =>
      parseEnv({
        ...prod,
        ...mailed,
        ...health,
        AUTH_URL: "https://fig.example.invalid",
      }),
    ).not.toThrow();
  });

  it("en production, exige HEALTH_TOKEN ; hors production, non", () => {
    const ready = {
      ...prod,
      ...mailed,
      AUTH_URL: "https://fig.example.invalid",
    };
    expect(() => parseEnv(ready)).toThrow(/HEALTH_TOKEN/);
    expect(
      productionProblems(parseEnv(ready, { enforceProduction: false })),
    ).toEqual([expect.stringMatching(/HEALTH_TOKEN[\s\S]*supervision/)]);
    expect(() => parseEnv({ ...ready, ...health })).not.toThrow();
    expect(() =>
      parseEnv({ ...ready, NODE_ENV: "test", HEALTH_TOKEN: undefined }),
    ).not.toThrow();
  });

  it("en production, exige le transport de mail, et la clé et l'expéditeur avec brevo", () => {
    const withUrl = {
      ...prod,
      ...health,
      AUTH_URL: "https://fig.example.invalid",
    };
    expect(() => parseEnv(withUrl)).toThrow(/MAIL_TRANSPORT/);
    expect(() => parseEnv({ ...withUrl, MAIL_TRANSPORT: "brevo" })).toThrow(
      /MAIL_API_KEY[\s\S]*MAIL_FROM/,
    );
    expect(() =>
      parseEnv({ ...withUrl, MAIL_TRANSPORT: "fichier" }),
    ).not.toThrow();
    expect(() => parseEnv({ ...withUrl, MAIL_TRANSPORT: "smtp" })).toThrow();
    expect(() =>
      parseEnv({ ...withUrl, ...mailed, MAIL_FROM: "pas-un-mail" }),
    ).toThrow();
  });
});

describe("HEALTH_TOKEN", () => {
  const base = {
    DATABASE_URL: "postgresql://fig:fig@localhost:5432/fig",
    AUTH_SECRET: "s".repeat(32),
  };

  it("facultatif, 16 caractères au moins, jamais reflété dans l'erreur", () => {
    expect(parseEnv(base).HEALTH_TOKEN).toBeUndefined();
    expect(
      parseEnv({ ...base, HEALTH_TOKEN: "jeton-de-sante-0123456789" })
        .HEALTH_TOKEN,
    ).toBe("jeton-de-sante-0123456789");
    let message = "";
    try {
      parseEnv({ ...base, HEALTH_TOKEN: "court-1234" });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toMatch(/HEALTH_TOKEN/);
    expect(message).not.toContain("court-1234");
  });
});

describe("API de l'application", () => {
  const base = {
    DATABASE_URL: "postgresql://fig:fig@localhost:5432/fig",
    AUTH_SECRET: "s".repeat(32),
  };

  it("API_SERVICE_KEY est facultative, 32 caractères au moins, jamais reflétée", () => {
    expect(parseEnv(base).API_SERVICE_KEY).toBeUndefined();
    expect(
      parseEnv({ ...base, API_SERVICE_KEY: "k".repeat(32) }).API_SERVICE_KEY,
    ).toBe("k".repeat(32));
    let message = "";
    try {
      parseEnv({ ...base, API_SERVICE_KEY: "cle-trop-courte" });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toMatch(/API_SERVICE_KEY/);
    expect(message).not.toContain("cle-trop-courte");
  });

  it("API_CORS_ORIGINS est une liste d'origines séparées par des virgules", () => {
    expect(parseEnv(base).API_CORS_ORIGINS).toBeUndefined();
    expect(
      parseEnv({
        ...base,
        API_CORS_ORIGINS: " https://app.fig.invalid, http://localhost:5173 ,",
      }).API_CORS_ORIGINS,
    ).toEqual(["https://app.fig.invalid", "http://localhost:5173"]);
    expect(() =>
      parseEnv({ ...base, API_CORS_ORIGINS: "app.fig.invalid" }),
    ).toThrow(/API_CORS_ORIGINS/);
  });
});

describe("mailTransportOf", () => {
  it("explicite, sinon brevo dès qu'une clé est posée, sinon fichier", () => {
    expect(mailTransportOf(parseEnv(base))).toBe("fichier");
    expect(mailTransportOf(parseEnv({ ...base, MAIL_API_KEY: "k" }))).toBe(
      "brevo",
    );
    expect(
      mailTransportOf(
        parseEnv({ ...base, MAIL_API_KEY: "k", MAIL_TRANSPORT: "fichier" }),
      ),
    ).toBe("fichier");
    expect(parseEnv({ ...base, PASSWORD_BREACH_CHECK: "0" })).toMatchObject({
      PASSWORD_BREACH_CHECK: "0",
    });
    expect(() => parseEnv({ ...base, PASSWORD_BREACH_CHECK: "oui" })).toThrow();
  });
});
