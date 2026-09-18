import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { customerLoginCodes, customerSessions } from "@/db/schema";
import { customersFixtures } from "@/domain/customers/fixtures";
import {
  apiRequest,
  codeIn,
  readJson,
  type StoredMail,
} from "../../../support/api";

/*
 * Routes d'accès de l'API (code par mail, session, inscription, déconnexion),
 * de bout en bout sur la base de test : environnement simulé, mails capturés
 * (façade simulée), journal capturé, after() exécuté à la demande. Chaque
 * test dans une transaction annulée.
 */
const hoisted = vi.hoisted(() => ({
  SECRET: "e2e-secret-fig-dashboard-0123456789-abcdef",
  mails: [] as { kind: string; to: string; subject: string; text: string }[],
  jobs: [] as Promise<unknown>[],
  logged: [] as Record<string, unknown>[],
}));
vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () =>
  import("../../../support/test-database").then((m) => m.dbClientMock),
);
vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    DATABASE_URL: "postgresql://fig:fig@localhost:5434/fig_test",
    AUTH_SECRET: hoisted.SECRET,
    AUTH_URL: "http://localhost:3126",
    API_CORS_ORIGINS: ["https://app.fig.invalid"],
  }),
}));
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

const { isolateEachTest, testDb } =
  await import("../../../support/test-database");
isolateEachTest();

const code = await import("@/app/api/v1/auth/code/route");
const session = await import("@/app/api/v1/auth/session/route");
const me = await import("@/app/api/v1/me/route");

const amel = customersFixtures.find((c) => c.id === "cli-0001")!;

async function lastMailTo(email: string): Promise<StoredMail> {
  await Promise.all(hoisted.jobs.splice(0));
  const mail = hoisted.mails.filter((m) => m.to === email).at(-1);
  if (!mail) throw new Error(`aucun mail pour ${email}`);
  return mail;
}

async function requestCode(email: string): Promise<string> {
  const res = await code.POST(
    apiRequest("POST", "/api/v1/auth/code", { body: { email } }),
  );
  expect(res.status).toBe(202);
  return codeIn(await lastMailTo(email.toLowerCase()));
}

const signup = {
  fullName: "Nadia Lemaire",
  phone: "06 39 98 00 91",
  addressLine: "3 rue des Vignes",
  city: "Paris",
  postalCode: "75012",
  consents: { offers: true, orderStatus: true, marketing: false },
};

describe("POST /api/v1/auth/code", () => {
  it("envoie un code à six chiffres, connu ou non, avec la même réponse, et journalise", async () => {
    const known = await code.POST(
      apiRequest("POST", "/api/v1/auth/code", {
        body: { email: amel.email.toUpperCase() },
      }),
    );
    expect(known.status).toBe(202);
    expect(known.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await readJson<{ ok: boolean; expiresAt: string }>(known);
    expect(body.ok).toBe(true);
    expect(Date.parse(body.expiresAt)).toBeGreaterThan(Date.now());
    const mail = await lastMailTo(amel.email);
    expect(mail.kind).toBe("customer_login_code");
    expect(codeIn(mail)).toMatch(/^\d{6}$/);

    const unknown = await code.POST(
      apiRequest("POST", "/api/v1/auth/code", {
        body: { email: "inconnue@example.invalid" },
      }),
    );
    expect(unknown.status).toBe(202);
    await lastMailTo("inconnue@example.invalid");
    expect(
      hoisted.logged.filter((e) => e.type === "api_code_requested"),
    ).toEqual([
      expect.objectContaining({ email: amel.email, customerId: amel.id }),
      expect.objectContaining({
        email: "inconnue@example.invalid",
        customerId: null,
      }),
    ]);
    // Seul le HMAC est en base, jamais le code.
    const rows = await testDb()
      .select()
      .from(customerLoginCodes)
      .where(eq(customerLoginCodes.email, amel.email));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.codeHash).not.toContain(codeIn(mail));
  });

  it("refuse une adresse invalide (422) et un corps qui n'est pas du JSON (415)", async () => {
    const invalid = await code.POST(
      apiRequest("POST", "/api/v1/auth/code", { body: { email: "x" } }),
    );
    expect(invalid.status).toBe(422);
    expect((await readJson(invalid)).error).toMatchObject({
      code: "validation_failed",
    });
    const text = await code.POST(
      apiRequest("POST", "/api/v1/auth/code", {
        rawBody: "email=x",
        headers: { "content-type": "text/plain" },
      }),
    );
    expect(text.status).toBe(415);
  });

  it("limite à trois demandes par quart d'heure pour une même adresse (429, Retry-After)", async () => {
    for (let i = 0; i < 3; i++) await requestCode("quota@example.invalid");
    const res = await code.POST(
      apiRequest("POST", "/api/v1/auth/code", {
        body: { email: "quota@example.invalid" },
      }),
    );
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect((await readJson(res)).error).toMatchObject({ code: "rate_limited" });
    expect(hoisted.logged.at(-1)).toMatchObject({ type: "api_code_throttled" });
  });

  it("pose les en-têtes CORS pour une origine admise seulement", async () => {
    const allowed = await code.OPTIONS(
      apiRequest("OPTIONS", "/api/v1/auth/code", {
        headers: { origin: "https://app.fig.invalid" },
      }),
    );
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://app.fig.invalid",
    );
    expect(allowed.headers.get("Access-Control-Allow-Methods")).toBe(
      "POST, OPTIONS",
    );
    const other = await code.OPTIONS(
      apiRequest("OPTIONS", "/api/v1/auth/code", {
        headers: { origin: "https://pirate.invalid" },
      }),
    );
    expect(other.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});

describe("POST /api/v1/auth/session", () => {
  it("ouvre une session pour une adresse connue, refuse un mauvais code, verrouille au cinquième", async () => {
    const good = await requestCode(amel.email);
    const wrong = String((Number(good) + 1) % 1_000_000).padStart(6, "0");
    const bad = await session.POST(
      apiRequest("POST", "/api/v1/auth/session", {
        body: { email: amel.email, code: wrong },
      }),
    );
    expect(bad.status).toBe(401);
    expect((await readJson(bad)).error).toMatchObject({ code: "code_invalid" });

    const ok = await session.POST(
      apiRequest("POST", "/api/v1/auth/session", {
        body: { email: amel.email, code: good },
      }),
    );
    expect(ok.status).toBe(200);
    const opened = await readJson<{
      token: string;
      expiresAt: string;
      created: boolean;
      customer: { id: string };
    }>(ok);
    expect(opened.token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(opened.created).toBe(false);
    expect(opened.customer.id).toBe(amel.id);
    expect(hoisted.logged.at(-1)).toMatchObject({
      type: "api_session_opened",
      customerId: amel.id,
      signup: false,
    });

    // Le code ne sert qu'une fois.
    const replay = await session.POST(
      apiRequest("POST", "/api/v1/auth/session", {
        body: { email: amel.email, code: good },
      }),
    );
    expect(replay.status).toBe(401);

    // Le jeton ouvre /me ; seul son HMAC est en base.
    const profile = await me.GET(
      apiRequest("GET", "/api/v1/me", { token: opened.token }),
    );
    expect(profile.status).toBe(200);
    expect((await readJson(profile)).email).toBe(amel.email);
    const stored = await testDb()
      .select()
      .from(customerSessions)
      .where(eq(customerSessions.customerId, amel.id));
    expect(stored).toHaveLength(1);
    expect(stored[0]!.tokenHash).not.toBe(opened.token);

    // Cinq codes faux annulent le code.
    const fresh = await requestCode(amel.email);
    const wrong2 = String((Number(fresh) + 7) % 1_000_000).padStart(6, "0");
    let last: Response | null = null;
    for (let i = 0; i < 5; i++) {
      last = await session.POST(
        apiRequest("POST", "/api/v1/auth/session", {
          body: { email: amel.email, code: wrong2 },
        }),
      );
    }
    expect((await readJson(last!)).error).toMatchObject({
      code: "code_locked",
    });
    const locked = await session.POST(
      apiRequest("POST", "/api/v1/auth/session", {
        body: { email: amel.email, code: fresh },
      }),
    );
    expect(locked.status).toBe(401);
  });

  it("inscrit une adresse inconnue avec son profil, son parrain et une communauté publique", async () => {
    const email = "nadia.lemaire@example.invalid";
    const good = await requestCode(email);
    const without = await session.POST(
      apiRequest("POST", "/api/v1/auth/session", {
        body: { email, code: good },
      }),
    );
    expect(without.status).toBe(404);
    expect((await readJson(without)).error).toMatchObject({
      code: "signup_required",
    });

    // Le code n'a pas été consommé par le refus : il sert à l'inscription.
    const created = await session.POST(
      apiRequest("POST", "/api/v1/auth/session", {
        body: {
          email,
          code: good,
          signup: {
            ...signup,
            referralCode: amel.referralCode,
            communityId: "com-0001",
          },
        },
      }),
    );
    expect(created.status).toBe(201);
    const opened = await readJson<{
      token: string;
      created: boolean;
      customer: {
        id: string;
        email: string;
        fullName: string;
        referralCode: string | null;
        referredBy: { fullName: string } | null;
        community: { id: string; discountPercent: number } | null;
        consents: { offers: boolean; updatedAt: string | null };
      };
    }>(created);
    expect(opened.created).toBe(true);
    expect(opened.customer).toMatchObject({
      email,
      fullName: signup.fullName,
      referredBy: { fullName: amel.fullName },
      community: { id: "com-0001" },
    });
    expect(opened.customer.referralCode).toMatch(/^Lemaire#\d{4}$/);
    expect(opened.customer.consents.updatedAt).not.toBeNull();
    expect(hoisted.logged.at(-1)).toMatchObject({
      type: "api_session_opened",
      signup: true,
    });

    const profile = await me.GET(
      apiRequest("GET", "/api/v1/me", { token: opened.token }),
    );
    expect(profile.status).toBe(200);
  });

  it("refuse un parrain inconnu et une communauté privée, sans créer le compte", async () => {
    const email = "nadia2@example.invalid";
    const good = await requestCode(email);
    const badReferral = await session.POST(
      apiRequest("POST", "/api/v1/auth/session", {
        body: {
          email,
          code: good,
          signup: { ...signup, referralCode: "Personne#0000" },
        },
      }),
    );
    expect(badReferral.status).toBe(422);
    expect((await readJson(badReferral)).error).toMatchObject({
      code: "referral_code_unknown",
    });
    // com-0002 est privée : sur invitation seulement.
    const privateCommunity = await session.POST(
      apiRequest("POST", "/api/v1/auth/session", {
        body: {
          email,
          code: await requestCode(email),
          signup: { ...signup, communityId: "com-0002" },
        },
      }),
    );
    expect(privateCommunity.status).toBe(422);
    expect((await readJson(privateCommunity)).error).toMatchObject({
      code: "community_not_joinable",
    });
  });

  it("DELETE révoque la session : le jeton ne sert plus", async () => {
    const good = await requestCode(amel.email);
    const ok = await session.POST(
      apiRequest("POST", "/api/v1/auth/session", {
        body: { email: amel.email, code: good },
      }),
    );
    const { token } = await readJson<{ token: string }>(ok);
    const closed = await session.DELETE(
      apiRequest("DELETE", "/api/v1/auth/session", { token }),
    );
    expect(closed.status).toBe(204);
    const after = await me.GET(apiRequest("GET", "/api/v1/me", { token }));
    expect(after.status).toBe(401);
    expect(after.headers.get("WWW-Authenticate")).toBe("Bearer");
    expect((await readJson(after)).error).toMatchObject({
      code: "unauthenticated",
    });
    const noToken = await me.GET(apiRequest("GET", "/api/v1/me"));
    expect(noToken.status).toBe(401);
  });
});
