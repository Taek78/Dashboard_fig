import { beforeEach, describe, expect, it } from "vitest";
import {
  loginAttemptsMock,
  loginAttemptsMockSize,
  resetLoginAttemptsMock,
} from "@/data/login-attempts.mock";
import { EMAIL_POLICY, IP_POLICY, LONGEST_WINDOW_MS } from "@/lib/rate-limit";

/*
 * Stockage en mémoire des tentatives de connexion : même contrat que la table
 * login_attempts (test/contract/sources.pg.test.ts pour la version base).
 */
const NOW = Date.parse("2026-09-15T08:00:00.000Z");
const email = { key: "email:zaki@fig.invalid", policy: EMAIL_POLICY };
const ip = { key: "ip:203.0.113.5", policy: IP_POLICY };

beforeEach(() => resetLoginAttemptsMock());

describe("loginAttemptsMock", () => {
  it("lit uniquement les clés connues, en copie", async () => {
    expect((await loginAttemptsMock.read([email.key])).size).toBe(0);
    await loginAttemptsMock.recordFailure([email, ip], NOW);
    const states = await loginAttemptsMock.read([email.key, "ip:inconnue"]);
    expect([...states.keys()]).toEqual([email.key]);
    const state = states.get(email.key)!;
    state.failures = 99;
    expect((await loginAttemptsMock.read([email.key])).get(email.key)).toEqual({
      failures: 1,
      lastFailureAt: NOW,
      lockedUntil: null,
    });
  });

  it("applique la politique de chaque clé : l'e-mail verrouille avant l'adresse IP", async () => {
    for (let i = 0; i < EMAIL_POLICY.maxFailures; i++) {
      await loginAttemptsMock.recordFailure([email, ip], NOW + i);
    }
    const states = await loginAttemptsMock.read([email.key, ip.key]);
    expect(states.get(email.key)?.lockedUntil).not.toBeNull();
    expect(states.get(ip.key)?.lockedUntil).toBeNull();
  });

  it("clear efface les clés demandées", async () => {
    await loginAttemptsMock.recordFailure([email, ip], NOW);
    await loginAttemptsMock.clear([email.key]);
    expect([
      ...(await loginAttemptsMock.read([email.key, ip.key])).keys(),
    ]).toEqual([ip.key]);
  });

  it("purge les entrées expirées quand le stockage déborde", async () => {
    for (let i = 0; i <= 10_000; i++) {
      await loginAttemptsMock.recordFailure(
        [{ key: `ip:198.51.${i}`, policy: IP_POLICY }],
        NOW,
      );
    }
    expect(loginAttemptsMockSize()).toBe(10_001);
    await loginAttemptsMock.recordFailure([email], NOW + LONGEST_WINDOW_MS + 1);
    expect(loginAttemptsMockSize()).toBe(1);
  });
});
