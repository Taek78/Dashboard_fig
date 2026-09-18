import { and, eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import {
  apiIdempotencyKeys,
  customerLoginCodes,
  customerSessions,
} from "@/db/schema";
import { customersFixtures } from "@/domain/customers/fixtures";

/*
 * Couche données de l'accès à l'API et de l'idempotence, sur la base de test :
 * codes (un seul actif par adresse, essais atomiques, consommation unique,
 * purge), sessions (lecture jointe, touche, révocation, liste RGPD),
 * inscription (parrain, code unique réessayé, adresse prise), clés
 * d'idempotence (prise atomique, rejeu, corps différent, libération), et
 * anonymisation / purge RGPD des nouvelles tables.
 */
vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () =>
  import("../support/test-database").then((m) => m.dbClientMock),
);
const { isolateEachTest, testDb } = await import("../support/test-database");
isolateEachTest();

const { apiAuthDb } = await import("@/data/api-auth.db");
const { apiIdempotencyDb } = await import("@/data/api-idempotency.db");
const { anonymizeCustomerRows, purgeExpiredData } =
  await import("@/db/privacy");
const { privacyDb } = await import("@/data/privacy.db");

const NOW = new Date("2026-09-17T12:00:00.000Z");
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const amel = customersFixtures.find((c) => c.id === "cli-0001")!;

const signup = {
  email: "nouvelle@example.invalid",
  fullName: "Inès Da Silva",
  phone: "06 39 98 00 77",
  addressLine: null,
  city: "Paris",
  postalCode: "75011",
  consents: { offers: false, orderStatus: true, marketing: false },
  referralCode: null,
  communityId: null,
};

describe("codes de connexion", () => {
  it("un seul actif par adresse, essais comptés, consommé une fois, purgé un jour après expiration", async () => {
    const first = await apiAuthDb.issueLoginCode({
      email: "a@example.invalid",
      codeHash: "h1",
      requestedIp: "1.1.1.1",
      now: NOW,
    });
    const second = await apiAuthDb.issueLoginCode({
      email: "a@example.invalid",
      codeHash: "h2",
      requestedIp: null,
      now: new Date(NOW.getTime() + 1000),
    });
    expect((await apiAuthDb.findActiveLoginCode("a@example.invalid"))?.id).toBe(
      second.id,
    );
    const [old] = await testDb()
      .select()
      .from(customerLoginCodes)
      .where(eq(customerLoginCodes.id, first.id));
    expect(old?.consumedAt).not.toBeNull();

    expect(await apiAuthDb.recordLoginCodeAttempt(second.id)).toBe(1);
    expect(await apiAuthDb.recordLoginCodeAttempt(second.id)).toBe(2);
    expect(await apiAuthDb.consumeLoginCode(second.id, NOW)).toBe(true);
    expect(await apiAuthDb.consumeLoginCode(second.id, NOW)).toBe(false);
    expect(await apiAuthDb.findActiveLoginCode("a@example.invalid")).toBeNull();

    // Purge à l'émission : un code expiré depuis plus d'un jour disparaît.
    await testDb()
      .insert(customerLoginCodes)
      .values({
        id: "code-vieux",
        email: "b@example.invalid",
        codeHash: "h",
        expiresAt: new Date(NOW.getTime() - 2 * DAY),
        createdAt: new Date(NOW.getTime() - 2 * DAY - 10 * 60_000),
      });
    await apiAuthDb.issueLoginCode({
      email: "c@example.invalid",
      codeHash: "h3",
      requestedIp: null,
      now: NOW,
    });
    expect(
      await testDb()
        .select()
        .from(customerLoginCodes)
        .where(eq(customerLoginCodes.id, "code-vieux")),
    ).toEqual([]);
  });
});

describe("sessions", () => {
  it("se lisent avec le client en une fois, se touchent, se révoquent une fois et se listent pour l'export", async () => {
    const session = await apiAuthDb.openSession(amel.id, "hash-1", NOW);
    const found = await apiAuthDb.findSession("hash-1");
    expect(found?.session.id).toBe(session.id);
    expect(found?.customer).toMatchObject({
      id: amel.id,
      email: amel.email,
      communityId: null,
      anonymized: false,
    });
    expect(await apiAuthDb.findSession("hash-inconnu")).toBeNull();

    await apiAuthDb.touchSession(session.id, new Date(NOW.getTime() + HOUR));
    expect((await apiAuthDb.findSession("hash-1"))?.session.lastSeenAt).toBe(
      new Date(NOW.getTime() + HOUR).toISOString(),
    );
    expect(await apiAuthDb.revokeSession(session.id, NOW)).toBe(true);
    expect(await apiAuthDb.revokeSession(session.id, NOW)).toBe(false);
    await apiAuthDb.openSession(
      amel.id,
      "hash-2",
      new Date(NOW.getTime() + 1000),
    );
    const sessions = await apiAuthDb.listCustomerSessions(amel.id);
    expect(sessions.map((s) => s.tokenHash)).toEqual(["hash-1", "hash-2"]);
    expect(sessions[0]?.revokedAt).not.toBeNull();
    // L'export RGPD les reprend, dates seulement.
    const data = await privacyDb.getCustomerExportData(amel.id);
    expect(data?.sessions.map((s) => s.id)).toEqual(sessions.map((s) => s.id));
  });
});

describe("inscription", () => {
  it("crée le client avec un code de parrainage au format, résout le parrain, refuse une adresse prise", async () => {
    const created = await apiAuthDb.signupCustomer(
      { ...signup, referralCode: amel.referralCode },
      "hash-new",
      NOW,
    );
    expect(created.outcome).toBe("created");
    if (created.outcome !== "created") return;
    expect(created.customer).toMatchObject({
      email: signup.email,
      fullName: signup.fullName,
      referredBy: { id: amel.id, fullName: amel.fullName },
      consents: {
        offers: false,
        orderStatus: true,
        marketing: false,
        updatedAt: NOW.toISOString(),
      },
    });
    expect(created.customer.referralCode).toMatch(/^Da Silva#\d{4}$/);
    expect(created.session.customerId).toBe(created.customer.id);

    expect(
      await apiAuthDb.signupCustomer(
        { ...signup, email: "NOUVELLE@example.invalid" },
        "hash-x",
        NOW,
      ),
    ).toEqual({ outcome: "email_taken" });
    expect(
      await apiAuthDb.signupCustomer(
        { ...signup, email: "x@example.invalid", referralCode: "Inconnu#0000" },
        "hash-y",
        NOW,
      ),
    ).toEqual({ outcome: "referral_code_unknown" });
    expect(
      await apiAuthDb.signupCustomer(
        { ...signup, email: "y@example.invalid", communityId: "com-0002" },
        "hash-z",
        NOW,
      ),
    ).toEqual({ outcome: "community_not_joinable" });
    const joined = await apiAuthDb.signupCustomer(
      { ...signup, email: "z@example.invalid", communityId: "com-0001" },
      "hash-w",
      NOW,
    );
    expect(joined.outcome === "created" && joined.customer.community?.id).toBe(
      "com-0001",
    );
  });
});

describe("clés d'idempotence", () => {
  const input = {
    customerId: amel.id,
    key: "cle-0001",
    requestHash: "h-a",
    now: NOW,
    ttlMs: DAY,
  };

  it("prend la clé une fois, dit « en cours », rejoue la réponse, refuse un autre corps, se libère", async () => {
    expect(await apiIdempotencyDb.claim(input)).toEqual({ state: "claimed" });
    expect(await apiIdempotencyDb.claim(input)).toEqual({
      state: "in_progress",
    });
    expect(
      await apiIdempotencyDb.claim({ ...input, requestHash: "h-b" }),
    ).toEqual({ state: "mismatch" });
    await apiIdempotencyDb.complete({
      customerId: amel.id,
      key: "cle-0001",
      status: 201,
      body: { id: "x" },
    });
    expect(await apiIdempotencyDb.claim(input)).toEqual({
      state: "replay",
      status: 201,
      body: { id: "x" },
    });
    await apiIdempotencyDb.release(amel.id, "cle-0001");
    expect(await apiIdempotencyDb.claim(input)).toEqual({ state: "claimed" });
    // Une clé expirée est purgée à la prise suivante.
    await apiIdempotencyDb.claim({
      ...input,
      key: "cle-0002",
      now: new Date(NOW.getTime() - 2 * DAY),
    });
    await apiIdempotencyDb.claim({ ...input, key: "cle-0003" });
    const rows = await testDb()
      .select()
      .from(apiIdempotencyKeys)
      .where(
        and(
          eq(apiIdempotencyKeys.customerId, amel.id),
          eq(apiIdempotencyKeys.key, "cle-0002"),
        ),
      );
    expect(rows).toEqual([]);
  });
});

describe("RGPD : anonymisation et purge des tables de l'API", () => {
  it("l'anonymisation supprime sessions, codes de l'adresse et clés du client", async () => {
    const customerId = "cli-0007";
    const customer = customersFixtures.find((c) => c.id === customerId)!;
    await apiAuthDb.openSession(customerId, "hash-anon", NOW);
    await apiAuthDb.issueLoginCode({
      email: customer.email,
      codeHash: "h",
      requestedIp: null,
      now: NOW,
    });
    await apiIdempotencyDb.claim({
      customerId,
      key: "cle-anon",
      requestHash: "h",
      now: NOW,
      ttlMs: DAY,
    });
    const outcome = await anonymizeCustomerRows(testDb(), customerId, NOW);
    if (outcome !== "anonymized") return;
    expect(
      await testDb()
        .select()
        .from(customerSessions)
        .where(eq(customerSessions.customerId, customerId)),
    ).toEqual([]);
    expect(
      await testDb()
        .select()
        .from(customerLoginCodes)
        .where(eq(customerLoginCodes.email, customer.email)),
    ).toEqual([]);
    expect(
      await testDb()
        .select()
        .from(apiIdempotencyKeys)
        .where(eq(apiIdempotencyKeys.customerId, customerId)),
    ).toEqual([]);
  });

  it("la purge compte puis supprime codes, sessions et clés hors durée, pas les autres", async () => {
    const retention = {
      inactiveCustomerYears: 50,
      securityEventMonths: 12,
      loginAttemptHours: 24,
      customerLoginCodeHours: 24,
      customerSessionDays: 30,
    };
    await testDb()
      .insert(customerLoginCodes)
      .values([
        {
          id: "code-purge-vieux",
          email: "p@example.invalid",
          codeHash: "h",
          expiresAt: new Date(NOW.getTime() - 2 * DAY),
        },
        {
          id: "code-purge-recent",
          email: "p@example.invalid",
          codeHash: "h",
          expiresAt: new Date(NOW.getTime() - HOUR),
        },
      ]);
    await testDb()
      .insert(customerSessions)
      .values([
        {
          id: "s-purge-vieille",
          customerId: amel.id,
          tokenHash: "t1",
          expiresAt: new Date(NOW.getTime() - 31 * DAY),
        },
        {
          id: "s-purge-revoquee",
          customerId: amel.id,
          tokenHash: "t2",
          expiresAt: new Date(NOW.getTime() + DAY),
          revokedAt: new Date(NOW.getTime() - 31 * DAY),
        },
        {
          id: "s-purge-vivante",
          customerId: amel.id,
          tokenHash: "t3",
          expiresAt: new Date(NOW.getTime() + DAY),
        },
      ]);
    await testDb()
      .insert(apiIdempotencyKeys)
      .values([
        {
          customerId: amel.id,
          key: "k-purge-vieille",
          requestHash: "h",
          expiresAt: new Date(NOW.getTime() - 1),
        },
        {
          customerId: amel.id,
          key: "k-purge-vivante",
          requestHash: "h",
          expiresAt: new Date(NOW.getTime() + DAY),
        },
      ]);
    const preview = await purgeExpiredData(testDb(), NOW, {
      apply: false,
      retention,
    });
    expect(preview).toMatchObject({
      customerLoginCodes: 1,
      customerSessions: 2,
      idempotencyKeys: 1,
    });
    const applied = await purgeExpiredData(testDb(), NOW, {
      apply: true,
      retention,
    });
    expect(applied).toMatchObject({
      customerLoginCodes: 1,
      customerSessions: 2,
      idempotencyKeys: 1,
    });
    expect(
      (
        await testDb()
          .select()
          .from(customerSessions)
          .where(eq(customerSessions.customerId, amel.id))
      ).map((s) => s.id),
    ).toEqual(["s-purge-vivante"]);
    expect(
      (
        await testDb()
          .select()
          .from(apiIdempotencyKeys)
          .where(eq(apiIdempotencyKeys.customerId, amel.id))
      ).map((k) => k.key),
    ).toEqual(["k-purge-vivante"]);
    expect(
      (
        await testDb()
          .select()
          .from(customerLoginCodes)
          .where(eq(customerLoginCodes.email, "p@example.invalid"))
      ).map((c) => c.id),
    ).toEqual(["code-purge-recent"]);
  });
});
