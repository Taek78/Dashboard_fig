import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

/*
 * Vérification contre les fuites (Have I Been Pwned, k-anonymity) avec un
 * fetch simulé : seul le préfixe de 5 caractères du SHA-1 part, la réponse
 * est comparée ici ; panne = null ; PASSWORD_BREACH_CHECK=0 = jamais d'appel.
 */
const env = vi.hoisted(() => ({
  current: {} as Record<string, string | undefined>,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    DATABASE_URL: "postgresql://fig:fig@localhost:5432/fig",
    AUTH_SECRET: "a".repeat(32),
    ...env.current,
  }),
}));

const { isPasswordPwned } = await import("@/data/pwned-passwords");

const sha1 = (s: string) =>
  createHash("sha1").update(s).digest("hex").toUpperCase();
const PASSWORD = "Motdepasse2026!";
const PREFIX = sha1(PASSWORD).slice(0, 5);
const SUFFIX = sha1(PASSWORD).slice(5);

function fakeFetch(body: string, status = 200) {
  return vi.fn(async () => new Response(body, { status }));
}

describe("isPasswordPwned", () => {
  it("n'envoie que le préfixe, avec le rembourrage, et reconnaît le suffixe", async () => {
    env.current = {};
    const fetchImpl = fakeFetch(`0000AAAA:0\r\n${SUFFIX}:12\r\nFFFFFFFF:3`);
    expect(
      await isPasswordPwned(PASSWORD, fetchImpl as unknown as typeof fetch),
    ).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(`https://api.pwnedpasswords.com/range/${PREFIX}`);
    expect(url).not.toContain(SUFFIX);
    expect((init.headers as Record<string, string>)["Add-Padding"]).toBe(
      "true",
    );
  });

  it("un suffixe absent, ou présent avec un compte 0 (rembourrage), n'est pas compromis", async () => {
    env.current = {};
    expect(
      await isPasswordPwned(
        PASSWORD,
        fakeFetch(`${SUFFIX}:0\r\nBBBBBBBB:5`) as unknown as typeof fetch,
      ),
    ).toBe(false);
    expect(
      await isPasswordPwned(
        PASSWORD,
        fakeFetch("BBBBBBBB:5") as unknown as typeof fetch,
      ),
    ).toBe(false);
  });

  it("une réponse en erreur ou un réseau absent donnent null", async () => {
    env.current = {};
    expect(
      await isPasswordPwned(
        PASSWORD,
        fakeFetch("", 503) as unknown as typeof fetch,
      ),
    ).toBeNull();
    const failing = vi.fn(async () => {
      throw new Error("réseau");
    });
    expect(
      await isPasswordPwned(PASSWORD, failing as unknown as typeof fetch),
    ).toBeNull();
  });

  it("PASSWORD_BREACH_CHECK=0 : faux sans aucun appel", async () => {
    env.current = { PASSWORD_BREACH_CHECK: "0" };
    const fetchImpl = fakeFetch(`${SUFFIX}:12`);
    expect(
      await isPasswordPwned(PASSWORD, fetchImpl as unknown as typeof fetch),
    ).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
