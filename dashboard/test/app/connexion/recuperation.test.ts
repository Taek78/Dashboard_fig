import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_ACCOUNTS } from "../../support/config";

/*
 * « Mot de passe oublié » de bout en bout sur la base de test (comptes seedés
 * usr-0001 admin, usr-0002 gestionnaire) : mails capturés (façade simulée),
 * after() exécuté à la demande, redirection et Auth.js simulés, journal
 * capturé, fuites connues simulées (jamais d'appel externe), horloge figée.
 * Chaque test dans une transaction annulée.
 */
const hoisted = vi.hoisted(() => {
  class RedirectSignal extends Error {
    constructor(public url: string) {
      super(`redirect:${url}`);
    }
  }
  return {
    RedirectSignal,
    SECRET: "e2e-secret-fig-dashboard-0123456789-abcdef",
    mails: [] as { kind: string; to: string; subject: string; text: string }[],
    jobs: [] as Promise<unknown>[],
    logged: [] as Record<string, unknown>[],
    signIn: vi.fn(),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () =>
  import("../../support/test-database").then((m) => m.dbClientMock),
);
vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    DATABASE_URL: "postgresql://fig:fig@localhost:5434/fig_test",
    AUTH_SECRET: hoisted.SECRET,
    AUTH_URL: "http://localhost:3126",
  }),
}));
vi.mock("@/data/mail", () => ({
  sendMail: vi.fn(),
  trySendMail: async (
    kind: string,
    message: { to: { email: string }; subject: string; text: string },
  ) => {
    hoisted.mails.push({
      kind,
      to: message.to.email,
      subject: message.subject,
      text: message.text,
    });
    return true;
  },
}));
vi.mock("next/server", () => ({
  after: (fn: () => unknown) => {
    hoisted.jobs.push(Promise.resolve().then(fn));
  },
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.9" }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new hoisted.RedirectSignal(url);
  },
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

const { requestRecoveryCode, verifyRecoveryCode } =
  await import("@/app/connexion/recuperation/actions");
const { findActiveToken } = await import("@/data/auth-tokens");
const { findUserById } = await import("@/data/users");
const { verifyPassword } = await import("@/lib/password");
const { idleActionResult } = await import("@/lib/action-result");
const { AuthError } = await import("next-auth");

const ADMIN = TEST_ACCOUNTS.admin.email;
const STEP2 = `redirect:/connexion/recuperation?etape=code&email=${encodeURIComponent(ADMIN)}`;

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.append(k, v);
  return data;
}
const request = (email: string) =>
  requestRecoveryCode(idleActionResult, form({ email }));
const verify = (fields: Record<string, string>) =>
  verifyRecoveryCode(idleActionResult, form({ email: ADMIN, ...fields }));
const flush = () => Promise.all(hoisted.jobs.splice(0));
const codeIn = (text: string) => text.match(/^\s*(\d{6})\s*$/m)![1]!;
const otherCode = (code: string) =>
  String((Number(code) + 1) % 1_000_000).padStart(6, "0");

/** Demande un code pour l'admin et le lit dans le mail capturé. */
async function requestCode(): Promise<string> {
  await expect(request(ADMIN)).rejects.toThrow(STEP2);
  await flush();
  const mail = hoisted.mails.findLast((m) => m.kind === "recovery_code");
  if (!mail) throw new Error("aucun mail de code");
  return codeIn(mail.text);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-17T08:00:00.000Z"));
  hoisted.mails.length = 0;
  hoisted.logged.length = 0;
  hoisted.jobs.length = 0;
  hoisted.signIn.mockReset();
  hoisted.signIn.mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());

describe("requestRecoveryCode", () => {
  it("un compte actif reçoit un code et un lien de verrouillage ; la réponse est une redirection", async () => {
    const code = await requestCode();
    expect(code).toMatch(/^\d{6}$/);
    const mail = hoisted.mails[0]!;
    expect(mail.to).toBe(ADMIN);
    expect(mail.text).toContain("/connexion/verrouiller?jeton=");
    expect(mail.text).not.toContain(hoisted.SECRET);
    const token = await findActiveToken("recovery_code", "usr-0001");
    expect(token).toMatchObject({ attempts: 0, requestedIp: "203.0.113.9" });
    expect(token?.secretHash).not.toContain(code);
    expect(await findActiveToken("lock_link", "usr-0001")).not.toBeNull();
    expect(hoisted.logged).toContainEqual({
      type: "recovery_requested",
      email: ADMIN,
      ip: "203.0.113.9",
      userId: "usr-0001",
    });
  });

  it("une adresse inconnue reçoit la même redirection, sans mail ni jeton", async () => {
    await expect(request("personne@fig-demo.invalid")).rejects.toThrow(
      "redirect:/connexion/recuperation?etape=code&email=personne%40fig-demo.invalid",
    );
    await flush();
    expect(hoisted.mails).toEqual([]);
    expect(hoisted.logged).toContainEqual(
      expect.objectContaining({ type: "recovery_requested", userId: null }),
    );
  });

  it("refuse une adresse invalide et limite à trois demandes par quart d'heure", async () => {
    expect(await request("pas-un-mail")).toEqual({
      status: "error",
      message: "Saisissez une adresse e-mail valide.",
    });
    for (let i = 0; i < 3; i++) {
      await expect(request(ADMIN)).rejects.toThrow(STEP2);
    }
    const fourth = await request(ADMIN);
    expect(fourth.status).toBe("error");
    if (fourth.status === "error") {
      expect(fourth.message).toMatch(/Trop de demandes/);
    }
    expect(hoisted.logged).toContainEqual(
      expect.objectContaining({ type: "recovery_throttled", email: ADMIN }),
    );
    await flush();
    // Une nouvelle demande annule le code précédent : un seul code actif.
    expect(
      hoisted.mails.filter((m) => m.kind === "recovery_code"),
    ).toHaveLength(3);
  });
});

describe("verifyRecoveryCode", () => {
  it("cinq codes faux annulent le code et alertent les administrateurs", async () => {
    const code = await requestCode();
    const wrong = otherCode(code);
    const strong = "Salade de tomates au basilic";
    for (let i = 0; i < 4; i++) {
      expect(
        await verify({
          code: wrong,
          newPassword: strong,
          confirmPassword: strong,
        }),
      ).toEqual({
        status: "error",
        message: "Code incorrect ou expiré. Demandez un nouveau code.",
      });
    }
    expect(
      await verify({
        code: wrong,
        newPassword: strong,
        confirmPassword: strong,
      }),
    ).toEqual({
      status: "error",
      message:
        "Trop de codes erronés : ce code est annulé. Demandez un nouveau code.",
    });
    await flush();
    const alert = hoisted.mails.find((m) => m.kind === "admin_recovery_locked");
    expect(alert?.to).toBe(ADMIN);
    expect(alert?.subject).toMatch(/erronés/);
    expect(hoisted.logged).toContainEqual(
      expect.objectContaining({ type: "recovery_locked", userId: "usr-0001" }),
    );
    // Le bon code ne vaut plus rien, et le mot de passe n'a pas changé.
    expect(
      (await verify({ code, newPassword: strong, confirmPassword: strong }))
        .status,
    ).toBe("error");
    const account = await findUserById("usr-0001");
    expect(
      await verifyPassword(
        TEST_ACCOUNTS.admin.password,
        account!.passwordHash!,
      ),
    ).toBe(true);
    expect(hoisted.signIn).not.toHaveBeenCalled();
  });

  it("le bon code applique la politique de mots de passe, puis change le mot de passe, prévient et connecte", async () => {
    const code = await requestCode();
    const common = await verify({
      code,
      newPassword: "Motdepasse2026!",
      confirmPassword: "Motdepasse2026!",
    });
    expect(common.status).toBe("error");
    if (common.status === "error") expect(common.message).toMatch(/courant/);
    const personal = await verify({
      code,
      newPassword: "Admin E2E du back-office",
      confirmPassword: "Admin E2E du back-office",
    });
    expect(personal.status).toBe("error");
    if (personal.status === "error") {
      expect(personal.message).toMatch(/ni votre nom/);
    }

    const strong = "Salade de tomates au basilic";
    expect(
      await verify({ code, newPassword: strong, confirmPassword: strong }),
    ).toEqual({
      status: "success",
      message: "Mot de passe modifié. Connectez-vous avec le nouveau.",
    });
    expect(hoisted.signIn).toHaveBeenCalledWith("credentials", {
      email: ADMIN,
      password: strong,
      redirectTo: "/",
    });
    const account = await findUserById("usr-0001");
    expect(await verifyPassword(strong, account!.passwordHash!)).toBe(true);
    expect(account?.passwordChangedAt).toBe("2026-09-17T08:00:00.000Z");
    expect(await findActiveToken("recovery_code", "usr-0001")).toBeNull();

    await flush();
    const kinds = hoisted.mails.map((m) => m.kind);
    expect(kinds).toContain("password_recovered");
    expect(kinds).toContain("admin_password_recovered");
    const notice = hoisted.mails.find((m) => m.kind === "password_recovered");
    expect(notice?.to).toBe(ADMIN);
    expect(notice?.text).toContain("203.0.113.9");
    expect(notice?.text).toContain("/connexion/verrouiller?jeton=");
    expect(hoisted.logged).toContainEqual({
      type: "password_recovered",
      userId: "usr-0001",
      ip: "203.0.113.9",
    });
    // Le code est consommé : le rejouer échoue.
    expect(
      (await verify({ code, newPassword: strong, confirmPassword: strong }))
        .status,
    ).toBe("error");
  });

  it("un code expiré (5 minutes) est refusé comme un code faux", async () => {
    const code = await requestCode();
    vi.setSystemTime(new Date("2026-09-17T08:05:01.000Z"));
    const strong = "Salade de tomates au basilic";
    expect(
      await verify({ code, newPassword: strong, confirmPassword: strong }),
    ).toEqual({
      status: "error",
      message: "Code incorrect ou expiré. Demandez un nouveau code.",
    });
  });

  it("une saisie invalide ne consomme rien ; un refus d'Auth.js après le changement reste un succès", async () => {
    const code = await requestCode();
    expect(
      (await verify({ code: "12", newPassword: "x", confirmPassword: "x" }))
        .status,
    ).toBe("error");
    expect((await findActiveToken("recovery_code", "usr-0001"))?.attempts).toBe(
      0,
    );

    hoisted.signIn.mockRejectedValue(new AuthError("CredentialsSignin"));
    const strong = "Salade de tomates au basilic";
    expect(
      (await verify({ code, newPassword: strong, confirmPassword: strong }))
        .status,
    ).toBe("success");
  });
});
