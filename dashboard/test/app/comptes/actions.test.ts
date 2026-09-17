import { beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_ACCOUNTS } from "../../support/config";

/*
 * Server Actions de la gestion des comptes, de bout en bout sur la base de
 * test (comptes seedés : usr-0001 admin, usr-0002 gestionnaire) : session
 * simulée (rôle et id pilotables), server-only neutralisé, revalidatePath
 * espionné, journal de sécurité capturé, mails capturés (façade simulée),
 * after() exécuté à la demande, fuites connues simulées. Chaque test dans une
 * transaction annulée.
 */
const hoisted = vi.hoisted(() => ({
  SECRET: "e2e-secret-fig-dashboard-0123456789-abcdef",
  session: { id: "usr-0001", role: "admin" },
  mails: [] as { kind: string; to: string; subject: string; text: string }[],
  jobs: [] as Promise<unknown>[],
  logged: [] as Record<string, unknown>[],
  reopenSession: vi.fn(),
}));
vi.mock("@/data/session", () => ({
  getCurrentUser: async () => ({
    id: hoisted.session.id,
    name: "Admin E2E",
    role: hoisted.session.role,
  }),
  reopenSession: hoisted.reopenSession,
}));
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
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/server", () => ({
  after: (fn: () => unknown) => {
    hoisted.jobs.push(Promise.resolve().then(fn));
  },
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

const {
  cancelInvitation,
  createAccount,
  deleteAccount,
  resetAccountPassword,
  sendPasswordLink,
  setAccountActive,
  updateAccount,
} = await import("@/app/(dashboard)/comptes/actions");
const { listUsers, findUserByEmail, findUserById } =
  await import("@/data/users");
const { findActiveToken } = await import("@/data/auth-tokens");
const { verifyPassword } = await import("@/lib/password");
const { idleActionResult } = await import("@/lib/action-result");

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.append(k, v);
  return data;
}
const run = (action: typeof createAccount, fields: Record<string, string>) =>
  action(idleActionResult, form(fields));
const flush = () => Promise.all(hoisted.jobs.splice(0));

beforeEach(() => {
  hoisted.session.id = "usr-0001";
  hoisted.session.role = "admin";
  hoisted.mails.length = 0;
  hoisted.logged.length = 0;
  hoisted.jobs.length = 0;
  hoisted.reopenSession.mockReset();
  revalidatePath.mockClear();
});

describe("createAccount", () => {
  it("crée un compte sans mot de passe et lui envoie un lien d'invitation, puis refuse les doublons", async () => {
    const email = "nour@fig-demo.invalid";
    const result = await run(createAccount, {
      email,
      firstName: "Nour",
      lastName: "Benali",
      role: "gestionnaire",
    });
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.message).toMatch(/lien pour choisir son mot de passe/);
    }
    const account = await findUserByEmail(email);
    expect(account).toMatchObject({ role: "gestionnaire", passwordHash: null });
    expect(
      (await listUsers()).find((u) => u.email === email)?.hasPassword,
    ).toBe(false);
    expect(await findActiveToken("invitation", account!.id)).not.toBeNull();
    expect(revalidatePath).toHaveBeenCalledWith("/comptes", "layout");
    expect(hoisted.logged).toContainEqual(
      expect.objectContaining({
        type: "invitation_sent",
        userId: "usr-0001",
        targetId: account!.id,
      }),
    );
    await flush();
    expect(hoisted.mails).toEqual([
      expect.objectContaining({ kind: "invitation", to: email }),
    ]);
    expect(hoisted.mails[0]?.text).toContain(
      "http://localhost:3126/connexion/invitation?jeton=",
    );
    expect(hoisted.mails[0]?.text).toContain("Admin E2E vous a créé un compte");

    expect(
      await run(createAccount, {
        email: email.toUpperCase(),
        firstName: "Nour",
        lastName: "Bis",
        role: "lecture",
      }),
    ).toEqual({
      status: "error",
      message: "Un compte existe déjà avec cet e-mail.",
    });
    const sameName = await run(createAccount, {
      email: "autre@fig-demo.invalid",
      firstName: "nour",
      lastName: "benali",
      role: "lecture",
    });
    expect(sameName.status).toBe("error");
    if (sameName.status === "error") {
      expect(sameName.message).toMatch(/porte déjà ce prénom et ce nom/);
    }
  });

  it("refuse un non-administrateur et une saisie invalide", async () => {
    hoisted.session.role = "gestionnaire";
    expect(
      (
        await run(createAccount, {
          email: "x@fig-demo.invalid",
          firstName: "X",
          lastName: "Yz",
          role: "lecture",
        })
      ).status,
    ).toBe("error");
    hoisted.session.role = "admin";
    expect(
      (
        await run(createAccount, {
          email: "x@fig-demo.invalid",
          firstName: "X",
          lastName: "Y",
          role: "lecture",
        })
      ).status,
    ).toBe("error");
    expect(hoisted.mails).toEqual([]);
  });
});

describe("sendPasswordLink", () => {
  it("envoie un lien de nouveau mot de passe à un compte actif, refuse un compte désactivé", async () => {
    const result = await run(sendPasswordLink, { userId: "usr-0002" });
    expect(result.status).toBe("success");
    await flush();
    expect(hoisted.mails).toEqual([
      expect.objectContaining({
        kind: "invitation",
        to: TEST_ACCOUNTS.manager.email,
      }),
    ]);
    expect(hoisted.mails[0]?.subject).toMatch(/nouveau mot de passe/i);
    expect(await findActiveToken("invitation", "usr-0002")).not.toBeNull();

    await run(setAccountActive, { userId: "usr-0002", active: "0" });
    const inactive = await run(sendPasswordLink, { userId: "usr-0002" });
    expect(inactive.status).toBe("error");
    if (inactive.status === "error") {
      expect(inactive.message).toMatch(/désactivé/);
    }
    expect((await run(sendPasswordLink, { userId: "nope" })).status).toBe(
      "error",
    );
  });
});

describe("setAccountActive / updateAccount", () => {
  it("interdit de se désactiver soi-même et de retirer le dernier admin", async () => {
    expect(
      await run(setAccountActive, { userId: "usr-0001", active: "0" }),
    ).toEqual({
      status: "error",
      message: "Vous ne pouvez pas désactiver votre propre compte.",
    });
    const demote = await run(updateAccount, {
      userId: "usr-0001",
      firstName: "Admin",
      lastName: "E2E",
      role: "lecture",
    });
    expect(demote.status).toBe("error");
    if (demote.status === "error") {
      expect(demote.message).toContain("dernier administrateur");
    }
  });

  it("désactiver ferme les sessions ; réactiver rend la connexion possible", async () => {
    const email = TEST_ACCOUNTS.manager.email;
    expect(
      (await run(setAccountActive, { userId: "usr-0002", active: "0" })).status,
    ).toBe("success");
    expect(await findUserByEmail(email)).toBeNull();
    expect((await findUserById("usr-0002"))?.passwordChangedAt).not.toBeNull();
    await flush();
    expect(hoisted.mails).toEqual([
      expect.objectContaining({ kind: "account_deactivated", to: email }),
    ]);
    expect(hoisted.mails[0]?.text).toContain(
      `contactez votre administrateur, Admin E2E (${TEST_ACCOUNTS.admin.email}).`,
    );
    expect(
      (await run(setAccountActive, { userId: "usr-0002", active: "1" })).status,
    ).toBe("success");
    expect((await findUserByEmail(email))?.id).toBe("usr-0002");
    // Réactiver n'envoie rien.
    await flush();
    expect(hoisted.mails).toHaveLength(1);
  });

  it("refuse de renommer un compte avec le nom d'un autre", async () => {
    const taken = await run(updateAccount, {
      userId: "usr-0002",
      firstName: "admin",
      lastName: "e2e",
      role: "gestionnaire",
    });
    expect(taken.status).toBe("error");
    if (taken.status === "error") {
      expect(taken.message).toMatch(/porte déjà ce prénom et ce nom/);
    }
    expect(
      (
        await run(updateAccount, {
          userId: "usr-0002",
          firstName: "Gestion",
          lastName: "Deux",
          role: "gestionnaire",
        })
      ).status,
    ).toBe("success");
  });
});

describe("deleteAccount", () => {
  it("exige le mot SUPPRIMER (en toute casse), refuse son propre compte, le dernier administrateur actif et un non-administrateur", async () => {
    expect(
      await run(deleteAccount, { userId: "usr-0002", confirm: "oui" }),
    ).toEqual({
      status: "error",
      message: "Tapez SUPPRIMER pour confirmer la suppression.",
    });
    expect(
      await run(deleteAccount, { userId: "usr-0001", confirm: "supprimer" }),
    ).toEqual({
      status: "error",
      message: "Vous ne pouvez pas supprimer votre propre compte.",
    });
    // Depuis un autre administrateur : usr-0001 reste le dernier admin actif.
    hoisted.session.id = "usr-0002";
    expect(
      await run(deleteAccount, { userId: "usr-0001", confirm: "SUPPRIMER" }),
    ).toEqual({
      status: "error",
      message:
        "Impossible : ce compte est le dernier administrateur actif du back-office.",
    });
    hoisted.session.id = "usr-0001";
    hoisted.session.role = "gestionnaire";
    expect(
      (await run(deleteAccount, { userId: "usr-0002", confirm: "SUPPRIMER" }))
        .status,
    ).toBe("error");
    expect(await findUserById("usr-0002")).not.toBeNull();
  });

  it("supprime un compte et ses jetons, journalise, revalide ; un second administrateur reste supprimable tant que le premier demeure", async () => {
    await run(sendPasswordLink, { userId: "usr-0002" });
    expect(await findActiveToken("invitation", "usr-0002")).not.toBeNull();
    expect(
      await run(deleteAccount, { userId: "usr-0002", confirm: " supprimer " }),
    ).toEqual({
      status: "success",
      message:
        "Compte « Gestion E2E » supprimé ; un message l'en informe à son ancienne adresse.",
    });
    expect(await findUserById("usr-0002")).toBeNull();
    expect(await findActiveToken("invitation", "usr-0002")).toBeNull();
    await flush();
    expect(hoisted.mails).toContainEqual(
      expect.objectContaining({
        kind: "account_deleted",
        to: TEST_ACCOUNTS.manager.email,
      }),
    );
    expect(hoisted.logged).toContainEqual({
      type: "account_deleted",
      userId: "usr-0001",
      targetId: "usr-0002",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/comptes", "layout");
    expect(
      (await run(deleteAccount, { userId: "usr-0002", confirm: "SUPPRIMER" }))
        .status,
    ).toBe("error");

    const created = await run(createAccount, {
      email: "second@fig-demo.invalid",
      firstName: "Second",
      lastName: "Admin",
      role: "admin",
    });
    expect(created.status).toBe("success");
    const second = (await listUsers()).find(
      (u) => u.email === "second@fig-demo.invalid",
    );
    expect(
      await run(deleteAccount, { userId: second!.id, confirm: "SUPPRIMER" }),
    ).toEqual({
      status: "success",
      message:
        "Compte « Second Admin » supprimé ; un message l'en informe à son ancienne adresse.",
    });
  });
});

describe("cancelInvitation", () => {
  it("supprime un compte en attente d'activation et son lien, journalise ; refuse un compte activé, un inconnu et un non-administrateur", async () => {
    const email = "attente@fig-demo.invalid";
    await run(createAccount, {
      email,
      firstName: "Lina",
      lastName: "Attente",
      role: "lecture",
    });
    const pending = (await listUsers()).find((u) => u.email === email);
    expect(pending?.hasPassword).toBe(false);
    expect(pending?.invitationExpiresAt).not.toBeNull();
    await flush();
    hoisted.mails.length = 0;

    hoisted.session.role = "gestionnaire";
    expect((await run(cancelInvitation, { userId: pending!.id })).status).toBe(
      "error",
    );
    hoisted.session.role = "admin";
    expect(await run(cancelInvitation, { userId: pending!.id })).toEqual({
      status: "success",
      message:
        "Invitation de « Lina Attente » annulée : le compte est supprimé et le lien reçu ne fonctionne plus.",
    });
    expect(await findUserById(pending!.id)).toBeNull();
    expect(await findActiveToken("invitation", pending!.id)).toBeNull();
    expect(hoisted.logged).toContainEqual({
      type: "invitation_cancelled",
      userId: "usr-0001",
      targetId: pending!.id,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/comptes", "layout");
    // Aucun mail : la personne n'a jamais eu de compte actif.
    await flush();
    expect(hoisted.mails).toEqual([]);

    // Un compte activé ne s'annule pas : c'est une suppression, avec son mot.
    const refused = await run(cancelInvitation, { userId: "usr-0002" });
    expect(refused.status).toBe("error");
    if (refused.status === "error") {
      expect(refused.message).toMatch(/déjà activé/);
    }
    expect(await findUserById("usr-0002")).not.toBeNull();
    expect((await run(cancelInvitation, { userId: "nope" })).status).toBe(
      "error",
    );
  });
});

describe("resetAccountPassword", () => {
  it("active un compte invité : avis à la personne (mot de passe attribué, à changer) et aux administrateurs", async () => {
    const email = "depannage@fig-demo.invalid";
    await run(createAccount, {
      email,
      firstName: "Sami",
      lastName: "Dépannage",
      role: "livreur",
    });
    const pending = (await listUsers()).find((u) => u.email === email);
    await flush();
    hoisted.mails.length = 0;

    const result = await run(resetAccountPassword, {
      userId: pending!.id,
      password: "Betterave rouge du dimanche",
    });
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.message).toMatch(/activé avec ce mot de passe/);
    }
    expect(
      (await listUsers()).find((u) => u.id === pending!.id)?.hasPassword,
    ).toBe(true);
    await flush();
    expect(hoisted.mails.map((m) => [m.kind, m.to])).toEqual([
      ["account_activated", email],
      ["admin_account_activated", TEST_ACCOUNTS.admin.email],
    ]);
    expect(hoisted.mails[0]?.text).toContain(
      "celui que Admin E2E vous a attribué",
    );
    expect(hoisted.mails[0]?.text).toContain("rôle attribué : Livreur");
    expect(hoisted.mails[0]?.text).toContain("http://localhost:3126/connexion");
    expect(hoisted.mails[1]?.text).toContain("par Admin E2E");

    // Un second mot de passe sur ce compte activé n'envoie plus d'avis d'activation.
    expect(
      (
        await run(resetAccountPassword, {
          userId: pending!.id,
          password: "Carotte violette du matin",
        })
      ).status,
    ).toBe("success");
    await flush();
    expect(hoisted.mails).toHaveLength(2);
  });

  it("applique la politique, remplace le hachage et ferme les sessions ; refuse un compte inconnu", async () => {
    const weak = await run(resetAccountPassword, {
      userId: "usr-0002",
      password: "Gestion-E2E-2026!",
    });
    expect(weak.status).toBe("error");
    if (weak.status === "error") expect(weak.message).toMatch(/ni votre nom/);

    const strong = "Betterave rouge du dimanche";
    expect(
      (
        await run(resetAccountPassword, {
          userId: "usr-0002",
          password: strong,
        })
      ).status,
    ).toBe("success");
    const account = await findUserByEmail(TEST_ACCOUNTS.manager.email);
    expect(await verifyPassword(strong, account!.passwordHash!)).toBe(true);
    expect(
      await verifyPassword(
        TEST_ACCOUNTS.manager.password,
        account!.passwordHash!,
      ),
    ).toBe(false);
    expect(account?.passwordChangedAt).not.toBeNull();
    expect(hoisted.reopenSession).not.toHaveBeenCalled();
    expect(
      (await run(resetAccountPassword, { userId: "nope", password: strong }))
        .status,
    ).toBe("error");
  });

  it("l'administrateur qui change son propre mot de passe garde sa session", async () => {
    const strong = "Betterave rouge du dimanche";
    expect(
      (
        await run(resetAccountPassword, {
          userId: "usr-0001",
          password: strong,
        })
      ).status,
    ).toBe("success");
    expect(hoisted.reopenSession).toHaveBeenCalledWith(
      TEST_ACCOUNTS.admin.email,
      strong,
    );
  });
});
