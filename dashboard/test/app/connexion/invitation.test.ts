import { beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_ACCOUNTS } from "../../support/config";

/*
 * Lien d'invitation de bout en bout sur la base de test : jeton créé dans la
 * transaction du test, Auth.js et journal simulés, fuites connues simulées.
 */
const hoisted = vi.hoisted(() => ({
  SECRET: "e2e-secret-fig-dashboard-0123456789-abcdef",
  logged: [] as Record<string, unknown>[],
  signIn: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () =>
  import("../../support/test-database").then((m) => m.dbClientMock),
);
vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    DATABASE_URL: "postgresql://fig:fig@localhost:5434/fig_test",
    AUTH_SECRET: hoisted.SECRET,
  }),
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.9" }),
}));
vi.mock("next-auth", () => ({ AuthError: class AuthError extends Error {} }));
vi.mock("@/auth", () => ({ signIn: hoisted.signIn }));
vi.mock("@/data/security-log", () => ({
  logSecurity: (event: Record<string, unknown>) => {
    hoisted.logged.push(event);
  },
}));
vi.mock("@/data/pwned-passwords", () => ({
  isPasswordPwned: async () => false,
}));

const { isolateEachTest } = await import("../../support/test-database");
isolateEachTest();

const { acceptInvitation } = await import("@/app/connexion/invitation/actions");
const { createToken } = await import("@/data/auth-tokens");
const { findUserById, updateUser } = await import("@/data/users");
const { hashSecret } = await import("@/lib/secrets");
const { verifyPassword } = await import("@/lib/password");
const { tokenExpiresAt } = await import("@/domain/auth/tokens");
const { idleActionResult } = await import("@/lib/action-result");

const SECRET_LINK = "jeton-invitation-de-test-0123456789-abcdefghij";
const EXPIRED =
  "Ce lien n'est plus valable. Demandez un nouveau lien à votre administrateur.";

/* Chaque lien a son secret (HMAC unique en base) : le second sert au lien expiré. */
const OTHER_LINK = "autre-jeton-invitation-de-test-0123456789-abcdef";

async function invite(
  userId: string,
  expiresAt = tokenExpiresAt("invitation", Date.now()),
  secret = SECRET_LINK,
) {
  return createToken({
    kind: "invitation",
    userId,
    secretHash: hashSecret(secret, hoisted.SECRET),
    expiresAt,
    requestedIp: null,
  });
}

function accept(fields: Record<string, string>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.append(k, v);
  return acceptInvitation(idleActionResult, data);
}
const withPassword = (password: string, token = SECRET_LINK) =>
  accept({ token, newPassword: password, confirmPassword: password });

beforeEach(() => {
  hoisted.logged.length = 0;
  hoisted.signIn.mockReset();
  hoisted.signIn.mockResolvedValue(undefined);
});

describe("acceptInvitation", () => {
  it("applique la politique, enregistre le mot de passe, consomme le lien et connecte", async () => {
    await invite("usr-0002");
    const personal = await withPassword("Gestion E2E du back-office");
    expect(personal.status).toBe("error");
    if (personal.status === "error") {
      expect(personal.message).toMatch(/ni votre nom/);
    }

    const strong = "Carotte violette du matin";
    expect(await withPassword(strong)).toEqual({
      status: "success",
      message: "Mot de passe enregistré. Connectez-vous.",
    });
    expect(hoisted.signIn).toHaveBeenCalledWith("credentials", {
      email: TEST_ACCOUNTS.manager.email,
      password: strong,
      redirectTo: "/",
    });
    const account = await findUserById("usr-0002");
    expect(await verifyPassword(strong, account!.passwordHash!)).toBe(true);
    expect(account?.passwordChangedAt).not.toBeNull();
    expect(hoisted.logged).toContainEqual({
      type: "invitation_accepted",
      userId: "usr-0002",
      ip: "203.0.113.9",
    });

    // Une seule fois.
    expect(await withPassword("Autre phrase de passe encore")).toEqual({
      status: "error",
      message: EXPIRED,
    });
  });

  it("refuse un lien inconnu, expiré, ou d'un compte désactivé, avec le même message", async () => {
    const strong = "Carotte violette du matin";
    expect(await withPassword(strong, "x".repeat(40))).toEqual({
      status: "error",
      message: EXPIRED,
    });
    await invite("usr-0002", new Date(Date.now() - 1_000), OTHER_LINK);
    expect(await withPassword(strong, OTHER_LINK)).toEqual({
      status: "error",
      message: EXPIRED,
    });
    await invite("usr-0002");
    await updateUser("usr-0002", { active: false });
    expect(await withPassword(strong)).toEqual({
      status: "error",
      message: EXPIRED,
    });
    expect(hoisted.signIn).not.toHaveBeenCalled();
  });

  it("refuse une saisie invalide sans toucher au lien", async () => {
    await invite("usr-0002");
    expect(
      (
        await accept({
          token: SECRET_LINK,
          newPassword: "court",
          confirmPassword: "court",
        })
      ).status,
    ).toBe("error");
    expect(
      (
        await accept({
          token: SECRET_LINK,
          newPassword: "Carotte violette du matin",
          confirmPassword: "Autre chose",
        })
      ).status,
    ).toBe("error");
    expect((await withPassword("Carotte violette du matin")).status).toBe(
      "success",
    );
  });
});
