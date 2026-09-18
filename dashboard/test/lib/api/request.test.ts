import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  ApiError,
  errorBody,
  rateLimited,
  unauthenticated,
} from "@/lib/api/errors";
import {
  bearerToken,
  readJsonBody,
  readJsonBodyOrEmpty,
  readQuery,
} from "@/lib/api/request";

const schema = z.object({ name: z.string().min(2), count: z.number().int() });

const post = (body: BodyInit | null, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/v1/x", { method: "POST", body, headers });

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("aucune erreur levée");
}

describe("readJsonBody", () => {
  it("exige application/json, borne la taille, refuse un JSON illisible et détaille les champs invalides en français", async () => {
    const wrongType = await failure(
      readJsonBody(post("{}", { "content-type": "text/plain" }), schema),
    );
    expect(wrongType.status).toBe(415);
    expect(wrongType.code).toBe("unsupported_media_type");

    const tooBig = await failure(
      readJsonBody(
        post("{}", {
          "content-type": "application/json",
          "content-length": String(70_000),
        }),
        schema,
      ),
    );
    expect(tooBig.status).toBe(413);

    const broken = await failure(
      readJsonBody(
        post("{oops", { "content-type": "application/json" }),
        schema,
      ),
    );
    expect(broken.status).toBe(400);
    expect(broken.code).toBe("bad_request");

    const invalid = await failure(
      readJsonBody(
        post(JSON.stringify({ name: "a", count: 1.5 }), {
          "content-type": "application/json; charset=utf-8",
        }),
        schema,
      ),
    );
    expect(invalid.status).toBe(422);
    expect(invalid.code).toBe("validation_failed");
    const issues = (
      invalid.details as { issues: { path: string; message: string }[] }
    ).issues;
    expect(issues.map((i) => i.path)).toEqual(["name", "count"]);
    // Message zod localisé en français.
    expect(issues[0]!.message).toMatch(/caract/);

    await expect(
      readJsonBody(
        post(JSON.stringify({ name: "ab", count: 2 }), {
          "content-type": "application/json",
        }),
        schema,
      ),
    ).resolves.toEqual({ name: "ab", count: 2 });
  });

  it("readJsonBodyOrEmpty accepte l'absence de corps", async () => {
    const optional = z.object({ detail: z.string().optional() });
    await expect(readJsonBodyOrEmpty(post(null), optional)).resolves.toEqual(
      {},
    );
    await expect(
      readJsonBodyOrEmpty(post("", { "content-length": "0" }), optional),
    ).resolves.toEqual({});
    await expect(
      readJsonBodyOrEmpty(
        post('{"detail":"x"}', { "content-type": "application/json" }),
        optional,
      ),
    ).resolves.toEqual({ detail: "x" });
  });
});

describe("readQuery et bearerToken", () => {
  it("valide les paramètres d'URL", () => {
    const query = z.object({
      limit: z.coerce.number().int().max(50).default(20),
    });
    expect(readQuery("http://localhost/x", query)).toEqual({ limit: 20 });
    expect(readQuery("http://localhost/x?limit=7", query)).toEqual({
      limit: 7,
    });
    expect(() => readQuery("http://localhost/x?limit=99", query)).toThrow(
      ApiError,
    );
  });

  it("lit le porteur et ignore les autres schémas", () => {
    expect(bearerToken(post(null))).toBeNull();
    expect(bearerToken(post(null, { authorization: "Basic abc" }))).toBeNull();
    expect(bearerToken(post(null, { authorization: "Bearer " }))).toBeNull();
    expect(bearerToken(post(null, { authorization: "Bearer jeton-x " }))).toBe(
      "jeton-x",
    );
  });
});

describe("ApiError", () => {
  it("se sérialise sans pile ni détail superflu et porte ses en-têtes", () => {
    expect(errorBody(unauthenticated())).toEqual({
      error: {
        code: "unauthenticated",
        message: expect.stringMatching(/reconnectez/),
      },
    });
    expect(unauthenticated().headers).toEqual({ "WWW-Authenticate": "Bearer" });
    expect(rateLimited(1_500).headers).toEqual({ "Retry-After": "2" });
    const detailed = new ApiError(422, "quote_invalid", "Panier refusé.", {
      details: { problems: [] },
    });
    expect(errorBody(detailed)).toEqual({
      error: {
        code: "quote_invalid",
        message: "Panier refusé.",
        details: { problems: [] },
      },
    });
  });
});
