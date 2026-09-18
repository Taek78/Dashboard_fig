import {
  apiRoute,
  jsonText,
  noContent,
  preflight,
} from "@/app/api/v1/_lib/context";
import { getCatalogSettings, getProducts } from "@/data/products";
import { catalogView } from "@/domain/api/views";
import { etagMatches, etagOf, PUBLIC_CACHE } from "@/lib/api/etag";

/*
 * GET /api/v1/catalogue : les produits visibles avec leur statut de vente,
 * le paramètre « vente à stock 0 », les barèmes (frais, remises) et les
 * créneaux. Public (l'application l'affiche avant toute connexion), mis en
 * cache une minute, ETag : 304 quand rien n'a changé.
 */
export const dynamic = "force-dynamic";
const METHODS = ["GET"] as const;
export const OPTIONS = preflight(METHODS);

export const GET = apiRoute(METHODS, async (call) => {
  const [products, settings] = await Promise.all([
    getProducts(),
    getCatalogSettings(),
  ]);
  const text = JSON.stringify(
    catalogView(products, settings, call.now.toISOString()),
  );
  const etag = etagOf(text);
  const headers = { ETag: etag };
  if (etagMatches(call.request.headers.get("if-none-match"), etag)) {
    return noContent(call, { status: 304, cache: PUBLIC_CACHE, headers });
  }
  return jsonText(call, text, { cache: PUBLIC_CACHE, headers });
});
