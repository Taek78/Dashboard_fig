import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authTokens } from "@/db/schema";
import { TEST_ACCOUNTS } from "../support/config";

/*
 * Balayage des invitations expirées, sur la base de test : comptes invités
 * créés dans la transaction du test, liens INSÉRÉS à dates explicites
 * (émission et expiration, pour raisonner à un instant fixe sans contredire
 * l'invariant émission < expiration), mails capturés (façade simulée), journal
 * capturé. Vérifie qu'une invitation expirée prévient UNE fois la personne et
 * les administrateurs, qu'une invitation renvoyée redevient notifiable, et que
 * la minuterie appelle bien le balayage.
 */
const hoisted = vi.hoisted(() => ({
  mails: [] as { kind: string; to: string; subject: string; text: string }[],
  logged: [] as Record<string, unknown>[],
}));
vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () =>
  import("../support/test-database").then((m) => m.dbClientMock),
);
vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    DATABASE_URL: "postgresql://fig:fig@localhost:5434/fig_test",
    AUTH_SECRET: "e2e-secret-fig-dashboard-0123456789-abcdef",
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
vi.mock("@/data/security-log", () => ({
  logSecurity: (event: Record<string, unknown>) => {
    hoisted.logged.push(event);
  },
}));

const { isolateEachTest, testDb } = await import("../support/test-database");
isolateEachTest();

const { notifyExpiredInvitations, startInvitationExpiryTimer } =
  await import("@/data/invitation-expiry");
const { createUser, listUsers, expireInvitations, updateUser } =
  await import("@/data/users");

const HOUR = 3_600_000;
const NOW = new Date("2026-09-17T12:00:00.000Z");
const at = (hours: number) => new Date(NOW.getTime() + hours * HOUR);

async function invited(
  email: string,
  lastName: string,
  role: "lecture" | "admin" = "lecture",
) {
  const account = await createUser({
    email,
    firstName: "Nour",
    lastName,
    role,
    passwordHash: null,
  });
  if (typeof account === "string") throw new Error(account);
  return account;
}

/** Un lien d'invitation émis à `issued`, expirant à `expires` (dans la transaction du test). */
async function link(
  userId: string,
  secret: string,
  issued: Date,
  expires: Date,
) {
  await testDb()
    .insert(authTokens)
    .values({
      id: `tok-${secret}`,
      kind: "invitation",
      userId,
      secretHash: secret.padEnd(64, "0"),
      expiresAt: expires,
      requestedIp: null,
      createdAt: issued,
    });
}

beforeEach(() => {
  hoisted.mails.length = 0;
  hoisted.logged.length = 0;
});

describe("expireInvitations (source)", () => {
  it("marque et renvoie une seule fois les comptes invités dont le dernier lien est expiré", async () => {
    const late = await invited("late@fig-demo.invalid", "Retard");
    const fresh = await invited("fresh@fig-demo.invalid", "Frais");
    await link(late.id, "late-1", at(-49), at(-1));
    await link(fresh.id, "fresh-1", at(-47), at(1));

    const expired = await expireInvitations(NOW);
    expect(expired).toEqual([
      {
        id: late.id,
        email: "late@fig-demo.invalid",
        name: "Nour Retard",
        role: "lecture",
        expiresAt: at(-1).toISOString(),
      },
    ]);
    // Déjà notifié : plus rien, même plus tard ; le lien encore valable n'est pas expiré à son heure pile.
    expect(await expireInvitations(at(1))).toEqual([]);
    // Puis il expire à son tour.
    expect((await expireInvitations(at(2))).map((u) => u.id)).toEqual([
      fresh.id,
    ]);
  });

  it("ignore les comptes avec mot de passe, désactivés ou sans lien ; un lien renvoyé redevient notifiable", async () => {
    // usr-0001 et usr-0002 ont un mot de passe : jamais renvoyés.
    await invited("nolink@fig-demo.invalid", "Sanslien");
    const off = await invited("off@fig-demo.invalid", "Inactif");
    await link(off.id, "off-1", at(-49), at(-1));
    await updateUser(off.id, { active: false });
    expect(await expireInvitations(NOW)).toEqual([]);

    const again = await invited("again@fig-demo.invalid", "Encore");
    await link(again.id, "again-1", at(-50), at(-2));
    expect((await expireInvitations(NOW)).map((u) => u.id)).toEqual([again.id]);
    // Invitation renvoyée après l'avis (jeton plus récent) : notifiable de nouveau à son expiration.
    await link(again.id, "again-2", at(-1), at(1));
    expect(await expireInvitations(NOW)).toEqual([]);
    expect((await expireInvitations(at(2))).map((u) => u.id)).toEqual([
      again.id,
    ]);
    expect(await expireInvitations(at(3))).toEqual([]);
  });

  it("listUsers joint l'expiration du dernier lien d'invitation", async () => {
    const account = await invited("joint@fig-demo.invalid", "Joint");
    expect(
      (await listUsers()).find((u) => u.id === account.id)?.invitationExpiresAt,
    ).toBeNull();
    await link(account.id, "joint-1", at(-48), at(0));
    await link(account.id, "joint-2", at(-24), at(24));
    expect(
      (await listUsers()).find((u) => u.id === account.id)?.invitationExpiresAt,
    ).toBe(at(24).toISOString());
    expect(
      (await listUsers()).find((u) => u.id === "usr-0001")?.invitationExpiresAt,
    ).toBeNull();
  });
});

describe("notifyExpiredInvitations", () => {
  it("prévient la personne et chaque administrateur actif, journalise, une seule fois", async () => {
    const late = await invited("late@fig-demo.invalid", "Retard");
    await link(late.id, "late-1", at(-49), at(-1));
    // Un administrateur invité (sans mot de passe) n'est ni prévenu ni nommé.
    const pendingAdmin = await invited(
      "padmin@fig-demo.invalid",
      "Attente",
      "admin",
    );
    await link(pendingAdmin.id, "padmin-1", at(-47), at(1));

    expect(await notifyExpiredInvitations(NOW)).toBe(1);
    expect(hoisted.logged).toContainEqual({
      type: "invitation_expired",
      targetId: late.id,
    });
    expect(hoisted.mails.map((m) => [m.kind, m.to])).toEqual([
      ["invitation_expired", "late@fig-demo.invalid"],
      ["admin_invitation_expired", TEST_ACCOUNTS.admin.email],
    ]);
    const [person, admin] = hoisted.mails;
    expect(person?.subject).toMatch(/expiré/);
    expect(person?.text).toContain("Bonjour Nour Retard");
    expect(person?.text).toContain("a expiré le jeu. 17 sept. 2026, 13:00");
    expect(person?.text).toContain(
      `votre administrateur, Admin E2E (${TEST_ACCOUNTS.admin.email})`,
    );
    expect(person?.text).not.toContain("padmin@");
    expect(admin?.subject).toContain("Nour Retard");
    expect(admin?.text).toContain("late@fig-demo.invalid");
    expect(admin?.text).toContain("http://localhost:3126/comptes");

    expect(await notifyExpiredInvitations(NOW)).toBe(0);
    expect(hoisted.mails).toHaveLength(2);
  });

  it("ne fait rien sans invitation expirée", async () => {
    expect(await notifyExpiredInvitations(NOW)).toBe(0);
    expect(hoisted.mails).toEqual([]);
    expect(hoisted.logged).toEqual([]);
  });
});

describe("startInvitationExpiryTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("lance le balayage une minute après le démarrage, puis toutes les quinze minutes, une seule minuterie par processus ; un échec est signalé sans arrêter la suite", async () => {
    // Le travail est injecté : sous faux timers, le pilote PostgreSQL ne répondrait pas.
    const job = vi
      .fn<() => Promise<unknown>>()
      .mockResolvedValueOnce(1)
      .mockRejectedValueOnce(new Error("base indisponible"))
      .mockResolvedValue(0);
    const failure = vi.spyOn(console, "error").mockImplementation(() => {});
    startInvitationExpiryTimer(job);
    startInvitationExpiryTimer(job);
    expect(job).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(59_000);
    expect(job).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(job).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(15 * 60_000);
    expect(job).toHaveBeenCalledTimes(2);
    expect(failure).toHaveBeenCalledWith(
      "[invitations] balayage des invitations impossible",
      expect.any(Error),
    );
    await vi.advanceTimersByTimeAsync(15 * 60_000);
    expect(job).toHaveBeenCalledTimes(3);
    failure.mockRestore();
  });
});
