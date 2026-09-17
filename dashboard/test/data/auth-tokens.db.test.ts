import { describe, expect, it, vi } from "vitest";
import { hashSecret } from "@/lib/secrets";

/* Table auth_tokens sur la base de test (comptes seedés), chaque test dans une transaction annulée. */
vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () =>
  import("../support/test-database").then((m) => m.dbClientMock),
);

const { isolateEachTest } = await import("../support/test-database");
isolateEachTest();

const { authTokensDb } = await import("@/data/auth-tokens.db");

const KEY = "cle-de-test";
const NOW = Date.now();
const fresh = (
  kind: "recovery_code" | "lock_link" | "invitation",
  secret: string,
) => ({
  kind,
  userId: "usr-0002",
  secretHash: hashSecret(secret, KEY),
  expiresAt: new Date(NOW + 5 * 60_000),
  requestedIp: "203.0.113.5",
});

describe("authTokensDb", () => {
  it("crée un jeton lisible par son compte et par son HMAC, jamais le secret", async () => {
    const created = await authTokensDb.createToken(
      fresh("recovery_code", "042917"),
    );
    expect(created).toMatchObject({
      kind: "recovery_code",
      userId: "usr-0002",
      attempts: 0,
      consumedAt: null,
      requestedIp: "203.0.113.5",
    });
    expect(created.secretHash).not.toContain("042917");
    expect(
      (await authTokensDb.findActiveToken("recovery_code", "usr-0002"))?.id,
    ).toBe(created.id);
    expect(
      (
        await authTokensDb.findTokenByHash(
          "recovery_code",
          hashSecret("042917", KEY),
        )
      )?.id,
    ).toBe(created.id);
    expect(
      await authTokensDb.findTokenByHash(
        "lock_link",
        hashSecret("042917", KEY),
      ),
    ).toBeNull();
    expect(
      await authTokensDb.findActiveToken("invitation", "usr-0002"),
    ).toBeNull();
  });

  it("une sorte exclusive consomme le jeton précédent, un lien de verrouillage non", async () => {
    const first = await authTokensDb.createToken(
      fresh("recovery_code", "111111"),
    );
    const second = await authTokensDb.createToken(
      fresh("recovery_code", "222222"),
    );
    expect(
      (await authTokensDb.findActiveToken("recovery_code", "usr-0002"))?.id,
    ).toBe(second.id);
    expect(
      (await authTokensDb.findTokenByHash("recovery_code", first.secretHash))
        ?.consumedAt,
    ).not.toBeNull();

    const lockA = await authTokensDb.createToken(fresh("lock_link", "lien-a"));
    await authTokensDb.createToken(fresh("lock_link", "lien-b"));
    expect(
      (await authTokensDb.findTokenByHash("lock_link", lockA.secretHash))
        ?.consumedAt,
    ).toBeNull();
  });

  it("compte les essais et ne consomme qu'une fois", async () => {
    const token = await authTokensDb.createToken(
      fresh("recovery_code", "333333"),
    );
    expect(await authTokensDb.recordTokenAttempt(token.id)).toBe(1);
    expect(await authTokensDb.recordTokenAttempt(token.id)).toBe(2);
    expect(await authTokensDb.recordTokenAttempt("nope")).toBe(0);
    const at = new Date(NOW + 1_000);
    expect(await authTokensDb.consumeToken(token.id, at)).toBe(true);
    expect(await authTokensDb.consumeToken(token.id, at)).toBe(false);
    expect(
      await authTokensDb.findActiveToken("recovery_code", "usr-0002"),
    ).toBeNull();
    expect(
      (await authTokensDb.findTokenByHash("recovery_code", token.secretHash))
        ?.attempts,
    ).toBe(2);
  });

  it("purge à la création les jetons expirés depuis plus d'un jour", async () => {
    const old = await authTokensDb.createToken({
      ...fresh("invitation", "vieux"),
      expiresAt: new Date(NOW - 2 * 24 * 3_600_000),
    });
    const recent = await authTokensDb.createToken({
      ...fresh("lock_link", "recent"),
      expiresAt: new Date(NOW - 3_600_000),
    });
    await authTokensDb.createToken(fresh("lock_link", "nouveau"));
    expect(
      await authTokensDb.findTokenByHash("invitation", old.secretHash),
    ).toBeNull();
    expect(
      (await authTokensDb.findTokenByHash("lock_link", recent.secretHash))?.id,
    ).toBe(recent.id);
  });
});
