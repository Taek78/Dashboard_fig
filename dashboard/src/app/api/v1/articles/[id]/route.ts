import { apiRoute, json, preflight } from "@/app/api/v1/_lib/context";
import { getArticle } from "@/data/articles";
import { apiIdSchema } from "@/domain/api/schemas";
import { articleView } from "@/domain/api/views";
import { todayInParis } from "@/domain/deliveries/rules";
import { notFound } from "@/lib/api/errors";
import { PUBLIC_CACHE } from "@/lib/api/etag";

/* GET /api/v1/articles/{id} : un article visible et paru ; sinon 404. Public, cache d'une minute. */
export const dynamic = "force-dynamic";
const METHODS = ["GET"] as const;
export const OPTIONS = preflight(METHODS);

export const GET = apiRoute<{ id: string }>(METHODS, async (call) => {
  const id = apiIdSchema.safeParse(call.params.id);
  const article = id.success ? await getArticle(id.data) : null;
  if (
    !article ||
    !article.visible ||
    article.publishedAt > todayInParis(call.now)
  ) {
    throw notFound("Article introuvable.");
  }
  return json(call, articleView(article), { cache: PUBLIC_CACHE });
});
