import { describe, expect, it, vi } from "vitest";
import { articlesFixtures } from "@/domain/articles/fixtures";
import { todayInParis } from "@/domain/deliveries/rules";
import { productsFixtures } from "@/domain/products/fixtures";
import { apiRequest, params, readJson } from "../../../support/api";

/*
 * Lectures publiques de l'API (catalogue, articles, communautés, OpenAPI) sur
 * la base de test seedée : contenu, cache public, ETag et 304.
 */
vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () =>
  import("../../../support/test-database").then((m) => m.dbClientMock),
);
vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    DATABASE_URL: "postgresql://fig:fig@localhost:5434/fig_test",
    AUTH_SECRET: "e2e-secret-fig-dashboard-0123456789-abcdef",
  }),
}));
vi.mock("@/data/security-log", () => ({ logSecurity: () => {} }));

const { isolateEachTest } = await import("../../../support/test-database");
isolateEachTest();

const catalogue = await import("@/app/api/v1/catalogue/route");
const articles = await import("@/app/api/v1/articles/route");
const article = await import("@/app/api/v1/articles/[id]/route");
const communautes = await import("@/app/api/v1/communautes/route");
const openapi = await import("@/app/api/v1/openapi.json/route");

describe("GET /api/v1/catalogue", () => {
  it("liste les produits visibles avec leur statut, en cache public, et répond 304 à l'ETag", async () => {
    const res = await catalogue.GET(
      apiRequest("GET", "/api/v1/catalogue"),
      params({}),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe(
      "public, max-age=60, stale-while-revalidate=300",
    );
    const etag = res.headers.get("ETag");
    expect(etag).toMatch(/^W\//);
    const body = await readJson<{
      products: { id: string; saleStatus: string }[];
      settings: { sellWhenOutOfStock: boolean };
    }>(res);
    expect(body.products).toHaveLength(
      productsFixtures.filter((p) => p.visible).length,
    );
    expect(body.settings.sellWhenOutOfStock).toBe(false);
    expect(
      body.products.every((p) =>
        ["en_vente", "rupture", "indisponible"].includes(p.saleStatus),
      ),
    ).toBe(true);

    const unchanged = await catalogue.GET(
      apiRequest("GET", "/api/v1/catalogue", {
        headers: { "if-none-match": etag! },
      }),
      params({}),
    );
    expect(unchanged.status).toBe(304);
    expect(await unchanged.text()).toBe("");
    expect(unchanged.headers.get("ETag")).toBe(etag);
  });
});

describe("GET /api/v1/articles", () => {
  it("ne renvoie que les articles visibles et parus, les plus récents d'abord, bornés par limit", async () => {
    const today = todayInParis(new Date());
    const expected = articlesFixtures
      .filter((a) => a.visible && a.publishedAt <= today)
      .toSorted((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    const res = await articles.GET(
      apiRequest("GET", "/api/v1/articles"),
      params({}),
    );
    expect(res.status).toBe(200);
    const body = await readJson<{
      items: { id: string; publishedAt: string; categoryLabel: string }[];
      nextCursor: null;
    }>(res);
    expect(body.items.map((a) => a.publishedAt)).toEqual(
      expected.map((a) => a.publishedAt),
    );
    expect(body.nextCursor).toBeNull();
    expect(body.items[0]?.categoryLabel.length).toBeGreaterThan(0);

    const limited = await articles.GET(
      apiRequest("GET", "/api/v1/articles?limit=1"),
      params({}),
    );
    expect((await readJson<{ items: unknown[] }>(limited)).items).toHaveLength(
      1,
    );
    const invalid = await articles.GET(
      apiRequest("GET", "/api/v1/articles?limit=999"),
      params({}),
    );
    expect(invalid.status).toBe(422);
  });

  it("un article masqué ou programmé est introuvable", async () => {
    const shown = articlesFixtures.find(
      (a) => a.visible && a.publishedAt <= todayInParis(new Date()),
    )!;
    const ok = await article.GET(
      apiRequest("GET", `/api/v1/articles/${shown.id}`),
      params({ id: shown.id }),
    );
    expect(ok.status).toBe(200);
    expect((await readJson(ok)).title).toBe(shown.title);
    const hidden = articlesFixtures.find(
      (a) => !a.visible || a.publishedAt > todayInParis(new Date()),
    );
    if (hidden) {
      const res = await article.GET(
        apiRequest("GET", `/api/v1/articles/${hidden.id}`),
        params({ id: hidden.id }),
      );
      expect(res.status).toBe(404);
    }
    const missing = await article.GET(
      apiRequest("GET", "/api/v1/articles/art-9999"),
      params({ id: "art-9999" }),
    );
    expect(missing.status).toBe(404);
    expect((await readJson(missing)).error).toMatchObject({
      code: "not_found",
    });
  });
});

describe("GET /api/v1/communautes", () => {
  it("ne liste que les communautés publiques et actives, avec membres et taux, sans référent", async () => {
    const res = await communautes.GET(
      apiRequest("GET", "/api/v1/communautes"),
      params({}),
    );
    expect(res.status).toBe(200);
    const body = await readJson<{
      items: { id: string; memberCount: number; discountPercent: number }[];
    }>(res);
    expect(body.items.map((c) => c.id)).toEqual(["com-0001"]);
    expect(body.items[0]!.memberCount).toBe(11);
    expect(body.items[0]!.discountPercent).toBe(10);
    expect(JSON.stringify(body)).not.toContain("contact");
  });
});

describe("GET /api/v1/openapi.json", () => {
  it("sert le document OpenAPI en cache public", async () => {
    const res = openapi.GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("public");
    const body = await readJson<{
      openapi: string;
      paths: Record<string, unknown>;
    }>(res);
    expect(body.openapi).toBe("3.1.0");
    expect(Object.keys(body.paths)).toContain("/commandes");
  });
});
