import { describe, expect, it, vi } from "vitest";

/*
 * Les façades ne lisent pas l'environnement à l'import : `next build` charge les
 * pages sans .env.local (en CI notamment) et un selectSource() évalué au
 * chargement du module faisait échouer le build. getEnv() lève ici dès qu'il est
 * appelé : importer chaque façade doit rester possible.
 */
vi.mock("server-only", () => ({}));
const getEnv = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("getEnv() appelé au chargement du module");
  }),
);
vi.mock("@/lib/env", () => ({ getEnv }));

describe("façades de données", () => {
  it.each([
    ["articles", () => import("@/data/articles")],
    ["communities", () => import("@/data/communities")],
    ["customers", () => import("@/data/customers")],
    ["engagement", () => import("@/data/engagement")],
    ["messages", () => import("@/data/messages")],
    ["orders", () => import("@/data/orders")],
    ["products", () => import("@/data/products")],
    ["staff", () => import("@/data/staff")],
    ["users", () => import("@/data/users")],
  ])("%s s'importe sans lire l'environnement", async (_name, load) => {
    await expect(load()).resolves.toBeDefined();
    expect(getEnv).not.toHaveBeenCalled();
  });
});
