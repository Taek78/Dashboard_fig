import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_ACCOUNTS } from "../../support/config";

/*
 * « Adresse e-mail oubliée » de bout en bout sur la base de test : mails
 * capturés, after() exécuté à la demande, quota par nom et par IP dans
 * login_attempts (transaction annulée), horloge figée.
 */
const hoisted = vi.hoisted(() => ({
  mails: [] as { kind: string; to: string; text: string }[],
  jobs: [] as Promise<unknown>[],
  logged: [] as Record<string, unknown>[],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () =>
  import("../../support/test-database").then((m) => m.dbClientMock),
);
vi.mock("@/data/mail", () => ({
  sendMail: vi.fn(),
  trySendMail: async (
    kind: string,
    message: { to: { email: string }; text: string },
  ) => {
    hoisted.mails.push({ kind, to: message.to.email, text: message.text });
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

const { requestEmailReminder } =
  await import("@/app/connexion/adresse-oubliee/actions");
const { idleActionResult } = await import("@/lib/action-result");

const SENT =
  "Si un compte actif porte ce nom, un rappel vient d'être envoyé à son adresse e-mail.";

function remind(lastName: string) {
  const data = new FormData();
  data.append("lastName", lastName);
  return requestEmailReminder(idleActionResult, data);
}
const flush = () => Promise.all(hoisted.jobs.splice(0));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-17T08:00:00.000Z"));
  hoisted.mails.length = 0;
  hoisted.logged.length = 0;
});
afterEach(() => vi.useRealTimers());

describe("requestEmailReminder", () => {
  it("envoie à chaque compte actif qui porte ce NOM son propre rappel, sans casse ni accent (homonymes compris)", async () => {
    expect(await remind("é2e")).toEqual({
      status: "success",
      message: SENT,
    });
    await flush();
    expect(hoisted.mails.map((m) => m.to).toSorted()).toEqual(
      [TEST_ACCOUNTS.admin.email, TEST_ACCOUNTS.manager.email].toSorted(),
    );
    for (const mail of hoisted.mails) {
      expect(mail.kind).toBe("email_reminder");
      // Chaque rappel ne cite que l'adresse qui le reçoit.
      expect(mail.text).toContain(mail.to);
    }
    expect(hoisted.logged).toContainEqual({
      type: "email_reminder_requested",
      ip: "203.0.113.9",
      userId: "usr-0002",
    });
    expect(hoisted.logged).toContainEqual({
      type: "email_reminder_requested",
      ip: "203.0.113.9",
      userId: "usr-0001",
    });
    // Le prénom seul ne suffit pas.
    hoisted.mails.length = 0;
    expect((await remind("Gestion")).status).toBe("success");
    await flush();
    expect(hoisted.mails).toEqual([]);
  });

  it("un nom inconnu reçoit la même réponse, sans mail ; un nom trop court est refusé", async () => {
    expect(await remind("Personne Inconnue")).toEqual({
      status: "success",
      message: SENT,
    });
    await flush();
    expect(hoisted.mails).toEqual([]);
    expect(hoisted.logged).toContainEqual(
      expect.objectContaining({
        type: "email_reminder_requested",
        userId: null,
      }),
    );
    expect((await remind("Z")).status).toBe("error");
  });

  it("limite à trois demandes par quart d'heure pour un même nom", async () => {
    for (let i = 0; i < 3; i++) {
      expect((await remind("E2E")).status).toBe("success");
    }
    const fourth = await remind("e2e");
    expect(fourth.status).toBe("error");
    if (fourth.status === "error") {
      expect(fourth.message).toMatch(/Trop de demandes/);
    }
    await flush();
    // Deux comptes portent ce nom : deux rappels par demande acceptée.
    expect(hoisted.mails).toHaveLength(6);
  });
});
