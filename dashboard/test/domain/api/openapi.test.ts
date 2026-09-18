import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildOpenApiDocument } from "@/domain/api/openapi";
import { API_ERROR_CODES } from "@/lib/api/errors";

/*
 * Le document OpenAPI est construit depuis les schémas zod ; le fichier
 * commité (docs/api/openapi.json) doit être celui du code : sinon, lancer
 * `npm run api:openapi`.
 */
type Operation = {
  operationId?: string;
  summary?: string;
  responses?: Record<string, { description?: string }>;
  security?: unknown[];
};

describe("buildOpenApiDocument", () => {
  const document = buildOpenApiDocument() as {
    openapi: string;
    info: { description: string };
    paths: Record<string, Record<string, Operation>>;
    components: {
      schemas: Record<string, unknown>;
      securitySchemes: Record<string, unknown>;
    };
  };

  it("décrit chaque route avec un identifiant, un résumé et des réponses documentées", () => {
    expect(document.openapi).toBe("3.1.0");
    const operations = Object.entries(document.paths).flatMap(
      ([route, methods]) =>
        Object.entries(methods).map(([method, op]) => ({ route, method, op })),
    );
    expect(operations.length).toBeGreaterThanOrEqual(19);
    const ids = new Set<string>();
    for (const { route, method, op } of operations) {
      expect(op.operationId, `${method} ${route}`).toBeTruthy();
      expect(ids.has(op.operationId!), `doublon ${op.operationId}`).toBe(false);
      ids.add(op.operationId!);
      expect(op.summary, `${method} ${route}`).toBeTruthy();
      const codes = Object.keys(op.responses ?? {});
      expect(
        codes.some((c) => c.startsWith("2") || c === "304"),
        `${method} ${route}`,
      ).toBe(true);
      expect(codes).toContain("429");
      expect(codes).toContain("500");
      for (const [code, response] of Object.entries(op.responses ?? {})) {
        expect(response.description, `${method} ${route} ${code}`).toBeTruthy();
      }
    }
    expect(document.components.securitySchemes).toHaveProperty("sessionToken");
    expect(document.components.securitySchemes).toHaveProperty("serviceKey");
    expect(Object.keys(document.components.schemas)).toEqual(
      expect.arrayContaining([
        "Error",
        "Customer",
        "Order",
        "Quote",
        "Message",
        "Catalog",
      ]),
    );
    for (const code of API_ERROR_CODES) {
      expect(document.info.description).toContain(code);
    }
  });

  it("ne contient aucun $schema résiduel et se sérialise", () => {
    const text = JSON.stringify(document);
    expect(text).not.toContain('"$schema"');
    expect(JSON.parse(text)).toEqual(document);
  });

  it("est identique au fichier commité docs/api/openapi.json (npm run api:openapi)", async () => {
    const file = await readFile(
      path.resolve(process.cwd(), "..", "docs", "api", "openapi.json"),
      "utf8",
    );
    expect(JSON.parse(file)).toEqual(document);
  });
});
