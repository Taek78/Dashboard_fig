import { describe, expect, it, vi } from "vitest";
import { EMAIL_POLICY, IP_POLICY, LONGEST_WINDOW_MS } from "@/lib/rate-limit";

/* Table login_attempts sur la base de test, chaque test dans une transaction annulée. */
vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () =>
  import("../support/test-database").then((m) => m.dbClientMock),
);
const { isolateEachTest } = await import("../support/test-database");
isolateEachTest();

const { loginAttemptsDb } = await import("@/data/login-attempts.db");

const NOW = Date.parse("2026-09-15T08:00:00.000Z");
const email = { key: "email:zaki@fig.invalid", policy: EMAIL_POLICY };
const ip = { key: "ip:203.0.113.5", policy: IP_POLICY };

describe("loginAttemptsDb", () => {
  it("lit uniquement les clés connues", async () => {
    expect((await loginAttemptsDb.read([email.key])).size).toBe(0);
    await loginAttemptsDb.recordFailure([email, ip], NOW);
    const states = await loginAttemptsDb.read([email.key, "ip:inconnue"]);
    expect([...states.keys()]).toEqual([email.key]);
    expect(states.get(email.key)).toEqual({
      failures: 1,
      lastFailureAt: NOW,
      lockedUntil: null,
    });
  });

  it("applique la politique de chaque clé : l'e-mail verrouille avant l'adresse IP", async () => {
    for (let i = 0; i < EMAIL_POLICY.maxFailures; i++) {
      await loginAttemptsDb.recordFailure([email, ip], NOW + i);
    }
    const states = await loginAttemptsDb.read([email.key, ip.key]);
    expect(states.get(email.key)?.lockedUntil).not.toBeNull();
    expect(states.get(ip.key)?.lockedUntil).toBeNull();
  });

  it("clear efface les clés demandées", async () => {
    await loginAttemptsDb.recordFailure([email, ip], NOW);
    await loginAttemptsDb.clear([email.key]);
    expect([
      ...(await loginAttemptsDb.read([email.key, ip.key])).keys(),
    ]).toEqual([ip.key]);
  });

  it("purge les lignes expirées sans verrou actif à chaque échec", async () => {
    await loginAttemptsDb.recordFailure([ip], NOW);
    await loginAttemptsDb.recordFailure([email], NOW + LONGEST_WINDOW_MS + 1);
    const states = await loginAttemptsDb.read([email.key, ip.key]);
    expect([...states.keys()]).toEqual([email.key]);
  });
});
