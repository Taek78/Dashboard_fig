import { describe, expect, it, vi } from "vitest";
import { EMAIL_POLICY } from "@/lib/rate-limit";

/*
 * Échecs de connexion SIMULTANÉS sur de vraies connexions (le pool, sans
 * transaction de test) : le verrou de ligne doit les compter tous. La clé est
 * unique à l'exécution et effacée à la fin du test (avant la fermeture du pool).
 */
vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () =>
  import("../support/test-database").then((m) => m.dbClientMock),
);
const { closeAfterAll } = await import("../support/test-database");
closeAfterAll();

const { loginAttemptsDb } = await import("@/data/login-attempts.db");

describe("loginAttemptsDb sous concurrence", () => {
  it("compte huit échecs simultanés sans en perdre", async () => {
    const key = `email:concurrence-${Date.now()}@fig-demo.invalid`;
    try {
      const now = Date.now();
      await Promise.all(
        Array.from({ length: 8 }, () =>
          loginAttemptsDb.recordFailure([{ key, policy: EMAIL_POLICY }], now),
        ),
      );
      const state = (await loginAttemptsDb.read([key])).get(key);
      expect(state?.failures).toBe(8);
      expect(state?.lockedUntil).not.toBeNull();
    } finally {
      await loginAttemptsDb.clear([key]);
    }
  });
});
