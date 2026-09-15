import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * authorizeCredentials de bout en bout : compte simulé (un seul, hachage
 * scrypt réel), limitation de débit dans la table login_attempts de la base de
 * test (transaction annulée par test), horloge figée (Date seulement : les
 * minuteries du pilote Postgres restent réelles). C'est le chemin commun au
 * formulaire et à la route HTTP d'Auth.js : limitation de débit, coût constant
 * (l'e-mail inconnu passe aussi par scrypt), remise à zéro après succès.
 */
vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () =>
  import("../support/test-database").then((m) => m.dbClientMock),
);
const accounts = vi.hoisted(() => ({ passwordHash: "" }));
vi.mock("@/data/users", () => ({
  findUserByEmail: async (email: string) =>
    email.toLowerCase() === "zaki@fig.invalid"
      ? {
          id: "usr-0001",
          email: "zaki@fig.invalid",
          name: "Zaki",
          role: "admin",
          passwordHash: accounts.passwordHash,
        }
      : null,
}));

const { isolateEachTest } = await import("../support/test-database");
isolateEachTest();

const { authorizeCredentials } = await import("@/data/credentials");
const { hashPassword } = await import("@/lib/password");

const GOOD = "Demo-FIG-2026-local";
const headers = (ip = "203.0.113.5") => new Headers({ "x-forwarded-for": ip });
const attempt = (email: string, password: string, ip?: string) =>
  authorizeCredentials({ email, password }, headers(ip));

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-14T08:00:00.000Z"));
  accounts.passwordHash = await hashPassword(GOOD);
});
afterEach(() => vi.useRealTimers());

describe("authorizeCredentials", () => {
  it("renvoie l'utilisateur (sans hachage) pour le bon mot de passe, null sinon", async () => {
    expect(await attempt("Zaki@fig.invalid", GOOD)).toEqual({
      id: "usr-0001",
      name: "Zaki",
      email: "zaki@fig.invalid",
      role: "admin",
    });
    expect(await attempt("zaki@fig.invalid", "faux-mot-de-passe")).toBeNull();
    expect(await attempt("inconnu@fig.invalid", GOOD)).toBeNull();
    expect(await authorizeCredentials({ email: "x" }, headers())).toBeNull();
  });

  it("cinq échecs verrouillent l'e-mail : même le bon mot de passe est refusé", async () => {
    for (let i = 0; i < 5; i++) {
      expect(await attempt("zaki@fig.invalid", "faux-mot-de-passe")).toBeNull();
    }
    expect(await attempt("zaki@fig.invalid", GOOD)).toBeNull();
    vi.setSystemTime(new Date("2026-09-14T08:01:01.000Z"));
    expect(await attempt("zaki@fig.invalid", GOOD)).not.toBeNull();
  });

  it("un e-mail inconnu compte aussi comme échec pour son adresse IP", async () => {
    for (let i = 0; i < 20; i++) {
      await attempt(`bot${i}@fig.invalid`, "faux-mot-de-passe", "198.51.100.9");
    }
    expect(await attempt("zaki@fig.invalid", GOOD, "198.51.100.9")).toBeNull();
    expect(
      await attempt("zaki@fig.invalid", GOOD, "203.0.113.5"),
    ).not.toBeNull();
  }, 60_000); // vingt scrypt : lent sur une machine chargée

  it("un succès efface le compteur de l'e-mail", async () => {
    for (let i = 0; i < 4; i++) {
      await attempt("zaki@fig.invalid", "faux-mot-de-passe");
    }
    expect(await attempt("zaki@fig.invalid", GOOD)).not.toBeNull();
    for (let i = 0; i < 4; i++) {
      await attempt("zaki@fig.invalid", "faux-mot-de-passe");
    }
    expect(await attempt("zaki@fig.invalid", GOOD)).not.toBeNull();
  });
});
