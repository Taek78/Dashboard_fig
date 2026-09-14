import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { productsMock, resetProductsMock } from "@/data/products.mock";

/*
 * Session simulée (rôle pilotable), server-only et env neutralisés, revalidatePath
 * espionné. redirect() de Next lève une exception : on simule la même chose pour
 * observer la cible de la redirection après une création ou une suppression.
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
const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
);
vi.mock("next/navigation", () => ({ redirect }));

const { addProduct, duplicateProduct, removeProduct, saveProduct } =
  await import("@/app/(dashboard)/catalogue/actions");
const { idleActionResult } = await import("@/lib/action-result");

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.append(k, v);
  return data;
}

const base = {
  name: "Poires",
  variety: "Conférence",
  category: "fruit",
  unit: "g",
  priceEuros: "3,20",
  unitWeightGrams: "",
  container: "tray",
  originCountry: "FR",
  originRegion: "Savoie",
  caliberMin: "",
  caliberMax: "",
  visible: "on",
  available: "on",
  stockQuantity: "5000",
  illustration: "🍐",
  imageUrl: "",
};

type Outcome = {
  result?: Awaited<ReturnType<typeof saveProduct>>;
  redirectedTo?: string;
};

async function run(
  action: typeof saveProduct,
  fields: Record<string, string>,
): Promise<Outcome> {
  const promise = action(idleActionResult, form(fields)).then(
    (result): Outcome => ({ result }),
    (error: Error): Outcome => ({
      redirectedTo: error.message.replace("NEXT_REDIRECT:", ""),
    }),
  );
  await vi.advanceTimersByTimeAsync(2000);
  return promise;
}

async function read(id: string) {
  const p = productsMock.getProduct(id);
  await vi.advanceTimersByTimeAsync(1000);
  return p;
}

beforeEach(() => {
  vi.useFakeTimers();
  session.role = "gestionnaire";
  resetProductsMock();
  revalidatePath.mockClear();
  redirect.mockClear();
});
afterEach(() => vi.useRealTimers());

describe("saveProduct", () => {
  it("enregistre toute la fiche (prix en centimes, calibre, cases)", async () => {
    const { result } = await run(saveProduct, {
      ...base,
      productId: "prd-0001",
      name: "Carottes",
      priceEuros: "3,10",
      caliberMin: "20",
      caliberMax: "30",
      organic: "on",
    });
    expect(result).toEqual({
      status: "success",
      message: "Fiche « Carottes » enregistrée.",
    });
    expect(await read("prd-0001")).toMatchObject({
      priceCents: 310,
      caliber: { minMm: 20, maxMm: 30 },
      organic: true,
      inSeason: false,
      originRegion: "Savoie",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/catalogue", "layout");
  });

  it("refuse une saisie invalide sans écrire, et le rôle lecture", async () => {
    const { result } = await run(saveProduct, {
      ...base,
      productId: "prd-0001",
      priceEuros: "x",
    });
    expect(result?.status).toBe("error");
    expect((await read("prd-0001"))?.priceCents).toBe(290);

    session.role = "lecture";
    const forbidden = await run(saveProduct, {
      ...base,
      productId: "prd-0001",
    });
    expect(forbidden.result).toEqual({
      status: "error",
      message: "Vous n'avez pas les droits pour modifier le catalogue.",
    });
  });

  it("signale un produit inconnu", async () => {
    const { result } = await run(saveProduct, {
      ...base,
      productId: "prd-9999",
    });
    expect(result).toEqual({
      status: "error",
      message: "Ce produit n'existe plus.",
    });
  });
});

describe("addProduct", () => {
  it("crée le produit puis redirige vers sa fiche", async () => {
    const { redirectedTo } = await run(addProduct, base);
    expect(redirectedTo).toBe("/catalogue/prd-m-1?cree=1");
    expect((await read("prd-m-1"))?.name).toBe("Poires");
    expect(revalidatePath).toHaveBeenCalledWith("/catalogue", "layout");
  });

  it("ne crée rien si la saisie est invalide", async () => {
    const { result } = await run(addProduct, { ...base, name: "" });
    expect(result?.status).toBe("error");
    expect(await read("prd-m-1")).toBeNull();
  });
});

describe("duplicateProduct", () => {
  it("crée une copie masquée nommée « (copie) » et redirige vers sa fiche", async () => {
    const { redirectedTo } = await run(duplicateProduct, {
      productId: "prd-0001",
    });
    expect(redirectedTo).toBe("/catalogue/prd-m-1?duplique=1");
    const copy = await read("prd-m-1");
    expect(copy).toMatchObject({
      name: "Carottes (copie)",
      visible: false,
      priceCents: 290,
      category: "vegetable",
    });
    expect((await read("prd-0001"))?.name).toBe("Carottes");
    expect(revalidatePath).toHaveBeenCalledWith("/catalogue", "layout");
  });

  it("refuse le rôle lecture et signale un produit inconnu", async () => {
    session.role = "lecture";
    expect(
      (await run(duplicateProduct, { productId: "prd-0001" })).result,
    ).toMatchObject({ status: "error" });
    session.role = "admin";
    expect(
      (await run(duplicateProduct, { productId: "prd-9999" })).result,
    ).toEqual({ status: "error", message: "Ce produit n'existe plus." });
    expect(await read("prd-m-1")).toBeNull();
  });
});

describe("removeProduct", () => {
  it("supprime avec le mot de confirmation puis redirige vers le catalogue", async () => {
    const { redirectedTo } = await run(removeProduct, {
      productId: "prd-0003",
      confirm: "SUPPRIMER",
    });
    expect(redirectedTo).toBe("/catalogue?supprime=1");
    expect(await read("prd-0003")).toBeNull();
  });

  it("refuse sans le mot exact, même par POST forgé", async () => {
    const { result } = await run(removeProduct, {
      productId: "prd-0003",
      confirm: "oui",
    });
    expect(result).toEqual({
      status: "error",
      message: "Tapez SUPPRIMER pour confirmer la suppression.",
    });
    expect((await read("prd-0003"))?.name).toBe("Bananes");
  });

  it("signale un produit déjà supprimé", async () => {
    const { result } = await run(removeProduct, {
      productId: "prd-9999",
      confirm: "SUPPRIMER",
    });
    expect(result).toEqual({
      status: "error",
      message: "Ce produit n'existe plus.",
    });
  });
});
