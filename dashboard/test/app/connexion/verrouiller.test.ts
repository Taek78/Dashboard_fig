import { beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_ACCOUNTS } from "../../support/config";

/*
 * « Ce n'était pas moi » de bout en bout sur la base de test : lien créé dans
 * la transaction du test, mails capturés, after() exécuté à la demande.
 */
const hoisted = vi.hoisted(() => ({
  SECRET: "e2e-secret-fig-dashboard-0123456789-abcdef",
  mails: [] as { kind: string; to: string; subject: string }[],
  jobs: [] as Promise<unknown>[],
  logged: [] as Record<string, unknown>[],
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
vi.mock("@/data/mail", () => ({
  sendMail: vi.fn(),
  trySendMail: async (
    kind: string,
    message: { to: { email: string }; subject: string },
  ) => {
    hoisted.mails.push({
      kind,
      to: message.to.email,
      subject: message.subject,
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
vi.mock("@/data/security-log", () => ({
  logSecurity: (event: Record<string, unknown>) => {
    hoisted.logged.push(event);
  },
}));

const { isolateEachTest } = await import("../../support/test-database");
isolateEachTest();

const { lockOwnAccount } = await import("@/app/connexion/verrouiller/actions");
const { createToken } = await import("@/data/auth-tokens");
const { findUserById, getUser } = await import("@/data/users");
const { hashSecret } = await import("@/lib/secrets");
const { tokenExpiresAt } = await import("@/domain/auth/tokens");
const { idleActionResult } = await import("@/lib/action-result");

let counter = 0;
async function lockLink(userId: string): Promise<string> {
  const secret = `lien-verrouillage-${counter++}-0123456789-abcdefghij`;
  await createToken({
    kind: "lock_link",
    userId,
    secretHash: hashSecret(secret, hoisted.SECRET),
    expiresAt: tokenExpiresAt("lock_link", Date.now()),
    requestedIp: "203.0.113.5",
  });
  return secret;
}

function lock(token: string) {
  const data = new FormData();
  data.append("token", token);
  return lockOwnAccount(idleActionResult, data);
}

beforeEach(() => {
  hoisted.mails.length = 0;
  hoisted.logged.length = 0;
  hoisted.jobs.length = 0;
});

describe("lockOwnAccount", () => {
  it("désactive le compte, ferme ses sessions, consomme le lien et alerte les administrateurs", async () => {
    const secret = await lockLink("usr-0002");
    const result = await lock(secret);
    expect(result.status).toBe("success");
    if (result.status === "success")
      expect(result.message).toMatch(/verrouillé/);
    expect((await getUser("usr-0002"))?.active).toBe(false);
    expect((await findUserById("usr-0002"))?.passwordChangedAt).not.toBeNull();
    expect(hoisted.logged).toContainEqual({
      type: "account_locked_by_owner",
      userId: "usr-0002",
      ip: "203.0.113.9",
    });
    await Promise.all(hoisted.jobs);
    expect(hoisted.mails).toEqual([
      expect.objectContaining({
        kind: "admin_account_locked",
        to: TEST_ACCOUNTS.admin.email,
      }),
    ]);

    // Le lien est consommé ; un autre lien sur un compte déjà verrouillé le dit.
    expect((await lock(secret)).status).toBe("error");
    const again = await lock(await lockLink("usr-0002"));
    expect(again).toEqual({
      status: "success",
      message:
        "Ce compte est déjà verrouillé. Votre administrateur peut le réactiver.",
    });
  });

  it("refuse un lien inconnu et ne verrouille jamais le dernier administrateur", async () => {
    const unknown = await lock("x".repeat(40));
    expect(unknown.status).toBe("error");
    if (unknown.status === "error") {
      expect(unknown.message).toMatch(/plus valable/);
    }
    const last = await lock(await lockLink("usr-0001"));
    expect(last.status).toBe("error");
    if (last.status === "error") {
      expect(last.message).toMatch(/dernier administrateur/);
    }
    expect((await getUser("usr-0001"))?.active).toBe(true);
    expect(hoisted.mails).toEqual([]);
  });
});
