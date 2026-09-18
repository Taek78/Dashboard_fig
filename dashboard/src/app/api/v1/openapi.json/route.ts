import { buildOpenApiDocument } from "@/domain/api/openapi";

/*
 * GET /api/v1/openapi.json : la description OpenAPI 3.1 de l'API, construite
 * depuis les schémas zod (domain/api/openapi.ts) : toujours celle du code qui
 * tourne. Publique, mise en cache cinq minutes ; la même est commitée dans
 * docs/api/openapi.json.
 */
export const dynamic = "force-static";

export function GET(): Response {
  return Response.json(buildOpenApiDocument(), {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
