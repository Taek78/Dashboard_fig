import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Action de connexion : Auth.js simulé (signIn), en-têtes simulés (adresse
 * IP), horloge figée (Date seulement), limitation de débit dans la base de test
 * (transaction annulée par test). La vérification et le comptage des échecs
 * vivent dans src/data/credentials.ts (testé à part) ; ici on vérifie que
 * l'action lit le verrou avant d'appeler Auth.js et que ses messages restent
 * génériques.
 */
const signIn = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () =>
  import("../../support/test-database").then((m) => m.dbClientMock),
);
vi.mock("@/auth", () => ({ signIn, signOut: vi.fn() }));
vi.mock("next-auth", () => ({ AuthError: class AuthError extends Error {} }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.5" }),
}));

const { isolateEachTest } = await import("../../support/test-database");
isolateEachTest();

const { login } = await import("@/app/connexion/actions");
const { AuthError } = await import("next-auth");
const { recordLoginFailure } = await import("@/data/login-attempts");
const { idleActionResult } = await import("@/lib/action-result");

function attempt(email: string, password = "Mauvais-mot-de-passe-1") {
  const data = new FormData();
  data.append("email", email);
  data.append("password", password);
  return login(idleActionResult, data);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-14T08:00:00.000Z"));
  signIn.mockReset();
  signIn.mockRejectedValue(new AuthError("CredentialsSignin"));
});
afterEach(() => vi.useRealTimers());

describe("login", () => {
  it("un échec renvoie le message générique, sans dire lequel des deux champs est faux", async () => {
    expect(await attempt("zaki@fig.invalid")).toEqual({
      status: "error",
      message: "E-mail ou mot de passe incorrect.",
    });
    expect(signIn).toHaveBeenCalledTimes(1);
  });

  it("un e-mail verrouillé reçoit le délai d'attente et n'atteint pas Auth.js", async () => {
    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      await recordLoginFailure(
        { email: "zaki@fig.invalid", ip: "203.0.113.5" },
        now,
      );
    }
    expect(await attempt("Zaki@fig.invalid")).toEqual({
      status: "error",
      message: "Trop de tentatives. Réessayez dans 1 minute.",
    });
    expect(signIn).not.toHaveBeenCalled();
  });

  it("une saisie invalide est refusée avant tout appel à Auth.js", async () => {
    const result = await attempt("pas-un-email", "x");
    expect(result.status).toBe("error");
    expect(signIn).not.toHaveBeenCalled();
  });

  it("relance la redirection de succès telle quelle", async () => {
    signIn.mockRejectedValueOnce(
      Object.assign(new Error("NEXT_REDIRECT"), {
        digest: "NEXT_REDIRECT;replace;/;307;",
      }),
    );
    await expect(
      attempt("zaki@fig.invalid", "Demo-FIG-2026-local"),
    ).rejects.toThrow("NEXT_REDIRECT");
  });
});
