import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { productsMock, resetProductsMock } from "@/data/products.mock";

/*
 * Session simulée : getCurrentUser() (Auth.js depuis A7) est remplacé par un
 * utilisateur de test dont le rôle est pilotable par cas (session.role).
 */
const session = vi.hoisted(() => ({ role: "gestionnaire" }));
vi.mock("@/data/session", () => ({
  getCurrentUser: async () => ({
    id: "usr-test",
    name: "Testeur",
    role: session.role,
  }),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ getEnv: () => ({ DATA_SOURCE: "mock" }) }));
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

const { saveProduct } =
  await import("@/app/(dashboard)/catalogue/[id]/actions");
const { idleActionResult } = await import("@/lib/action-result");

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.append(k, v);
  return data;
}

async function run(fields: Record<string, string>) {
  const promise = saveProduct(idleActionResult, form(fields));
  await vi.advanceTimersByTimeAsync(2000);
  return promise;
}

beforeEach(() => {
  vi.useFakeTimers();
  session.role = "gestionnaire";
  resetProductsMock();
  revalidatePath.mockClear();
});
afterEach(() => vi.useRealTimers());

describe("saveProduct", () => {
  it("enregistre un prix en euros converti en centimes, le stock et la disponibilité", async () => {
    const r = await run({
      productId: "prd-0001",
      priceEuros: "3,10",
      stockQuantity: "500",
    });
    expect(r).toEqual({
      status: "success",
      message: "Fiche « Carottes » enregistrée.",
    });
    const p = productsMock.getProduct("prd-0001");
    await vi.advanceTimersByTimeAsync(1000);
    expect(await p).toMatchObject({
      priceCents: 310,
      stockQuantity: 500,
      available: false,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/catalogue", "layout");
  });

  it("refuse une saisie invalide côté serveur sans écrire", async () => {
    const r = await run({
      productId: "prd-0001",
      priceEuros: "gratuit",
      stockQuantity: "10",
    });
    expect(r.status).toBe("error");
    const p = productsMock.getProduct("prd-0001");
    await vi.advanceTimersByTimeAsync(1000);
    expect((await p)?.priceCents).toBe(290);
  });

  it("signale un produit inconnu", async () => {
    const r = await run({
      productId: "prd-9999",
      priceEuros: "1,00",
      stockQuantity: "1",
    });
    expect(r).toEqual({
      status: "error",
      message: "Ce produit n'existe plus.",
    });
  });
});
