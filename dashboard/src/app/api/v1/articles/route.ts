import { apiRoute, json, preflight } from "@/app/api/v1/_lib/context";
import { getPublishedArticles } from "@/data/articles";
import { articlesQuerySchema } from "@/domain/api/schemas";
import { articleView } from "@/domain/api/views";
import { todayInParis } from "@/domain/deliveries/rules";
import { PUBLIC_CACHE } from "@/lib/api/etag";
import { readQuery } from "@/lib/api/request";

/*
 * GET /api/v1/articles?limit= : les articles visibles déjà parus (jour de
 * Paris), les plus récents d'abord. Public, cache d'une minute.
 */
export const dynamic = "force-dynamic";
const METHODS = ["GET"] as const;
export const OPTIONS = preflight(METHODS);

export const GET = apiRoute(METHODS, async (call) => {
  const { limit } = readQuery(call.request.url, articlesQuerySchema);
  const articles = await getPublishedArticles(todayInParis(call.now), limit);
  return json(
    call,
    { items: articles.map(articleView), nextCursor: null },
    { cache: PUBLIC_CACHE },
  );
});
