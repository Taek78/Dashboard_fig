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

  it("en production, exige AUTH_URL", () => {
    expect(() => parseEnv(prod)).toThrow(/AUTH_URL/);
    expect(() => parseEnv(prod, { enforceProduction: false })).not.toThrow();
    expect(
      productionProblems(parseEnv(prod, { enforceProduction: false })),
    ).toHaveLength(2);
    expect(() =>
      parseEnv({ ...prod, ...mailed, AUTH_URL: "https://fig.example.invalid" }),
    ).not.toThrow();
  });

  it("en production, exige le transport de mail, et la clé et l'expéditeur avec brevo", () => {
    const withUrl = { ...prod, AUTH_URL: "https://fig.example.invalid" };
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
