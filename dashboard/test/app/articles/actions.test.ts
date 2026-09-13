import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { articlesMock, resetArticlesMock } from "@/data/articles.mock";

/*
 * Server Actions des articles de bout en bout : session simulée (rôle
 * pilotable), server-only et env neutralisés, revalidatePath espionné,
 * redirect() simulé par une exception (même patron que le catalogue).
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

const { addArticle, removeArticle, saveArticle, setArticleVisibility } =
  await import("@/app/(dashboard)/articles/actions");
const { idleActionResult } = await import("@/lib/action-result");

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.append(k, v);
  return data;
}

const base = {
  title: "Manger de saison",
  body: "Un texte court.",
  category: "nutrition",
  illustration: "🥗",
  imageUrl: "",
  publishedAt: "2026-09-13",
  visible: "on",
};

type Outcome = {
  result?: Awaited<ReturnType<typeof saveArticle>>;
  redirectedTo?: string;
};

async function run(
  action: typeof saveArticle,
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
  const p = articlesMock.getArticle(id);
  await vi.advanceTimersByTimeAsync(1000);
  return p;
}

beforeEach(() => {
  vi.useFakeTimers();
  resetArticlesMock();
  revalidatePath.mockClear();
  redirect.mockClear();
  session.role = "gestionnaire";
});
afterEach(() => vi.useRealTimers());

describe("addArticle", () => {
  it("crée l'article, revalide et reste sur la page", async () => {
    const { result } = await run(addArticle, base);
    expect(result).toMatchObject({
      status: "success",
      message: expect.stringContaining("Manger de saison"),
    });
    expect(revalidatePath).toHaveBeenCalledWith("/articles", "layout");
    expect(redirect).not.toHaveBeenCalled();
    const created = await read("art-m-1");
    expect(created?.title).toBe("Manger de saison");
  });

  it("refuse le rôle lecture et une saisie invalide", async () => {
    session.role = "lecture";
    expect((await run(addArticle, base)).result?.status).toBe("error");
    session.role = "gestionnaire";
    const invalid = await run(addArticle, { ...base, category: "sport" });
    expect(invalid.result?.status).toBe("error");
    expect(await read("art-m-1")).toBeNull();
  });
});

describe("saveArticle", () => {
  it("modifie un article existant, refuse un id inconnu", async () => {
    const { result } = await run(saveArticle, {
      ...base,
      articleId: "art-0001",
      title: "Titre modifié",
    });
    expect(result?.status).toBe("success");
    expect((await read("art-0001"))?.title).toBe("Titre modifié");
    const missing = await run(saveArticle, { ...base, articleId: "art-x" });
    expect(missing.result).toEqual({
      status: "error",
      message: "Cet article n'existe plus.",
    });
  });
});

describe("setArticleVisibility", () => {
  it("masque puis réaffiche sans toucher au reste", async () => {
    const before = await read("art-0001");
    const hide = await run(setArticleVisibility, {
      articleId: "art-0001",
      visible: "0",
    });
    expect(hide.result?.status).toBe("success");
    const hidden = await read("art-0001");
    expect(hidden?.visible).toBe(false);
    expect(hidden?.title).toBe(before?.title);
    await run(setArticleVisibility, { articleId: "art-0001", visible: "1" });
    expect((await read("art-0001"))?.visible).toBe(true);
  });

  it("rôle lecture refusé", async () => {
    session.role = "lecture";
    const { result } = await run(setArticleVisibility, {
      articleId: "art-0001",
      visible: "0",
    });
    expect(result?.status).toBe("error");
    expect((await read("art-0001"))?.visible).toBe(true);
  });
});

describe("removeArticle", () => {
  it("exige la confirmation, puis supprime et redirige", async () => {
    const noConfirm = await run(removeArticle, { articleId: "art-0002" });
    expect(noConfirm.result?.status).toBe("error");
    expect(await read("art-0002")).not.toBeNull();

    const { redirectedTo } = await run(removeArticle, {
      articleId: "art-0002",
      confirm: "oui",
    });
    expect(redirectedTo).toBe("/articles?supprime=1");
    expect(await read("art-0002")).toBeNull();
    expect(revalidatePath).toHaveBeenCalledWith("/articles", "layout");
  });
});
