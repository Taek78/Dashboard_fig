import { z } from "zod";
import { MAX_JSON_BODY_BYTES } from "@/domain/api/types";
import { ApiError } from "@/lib/api/errors";

/*
 * Lecture et validation des entrées d'une requête de l'API (Web APIs
 * seulement, sans Next : testable avec un `Request` ordinaire).
 * - readJsonBody : Content-Type application/json exigé (415), corps borné
 *   (413 sur l'en-tête Content-Length, puis sur les octets lus), JSON valide
 *   (400), puis schéma zod (422 avec la liste des champs en cause) ;
 * - readQuery : mêmes règles sur les paramètres d'URL ;
 * - bearerToken : le porteur de l'en-tête Authorization, sinon null.
 * Les messages de zod sont en français (locale globale), les chemins des
 * champs en notation pointée (« lines.2.quantity »).
 */
z.config(z.locales.fr());

export type ValidationIssue = { path: string; message: string };

export function issuesOf(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message,
  }));
}

export function validationFailed(
  error: z.ZodError,
  message = "Requête invalide : vérifiez les champs signalés.",
): ApiError {
  return new ApiError(422, "validation_failed", message, {
    details: { issues: issuesOf(error) },
  });
}

export async function readJsonText(
  request: Request,
  maxBytes = MAX_JSON_BODY_BYTES,
): Promise<string> {
  const type = request.headers.get("content-type") ?? "";
  if (!/^application\/json(\s*;.*)?$/i.test(type.trim())) {
    throw new ApiError(
      415,
      "unsupported_media_type",
      "Le corps doit être en JSON (Content-Type: application/json).",
    );
  }
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > maxBytes) {
    throw new ApiError(
      413,
      "payload_too_large",
      `Corps trop volumineux (${maxBytes} octets au plus).`,
    );
  }
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    throw new ApiError(
      413,
      "payload_too_large",
      `Corps trop volumineux (${maxBytes} octets au plus).`,
    );
  }
  return text;
}

export function parseJson<T>(text: string, schema: z.ZodType<T>): T {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ApiError(
      400,
      "bad_request",
      "Le corps n'est pas un JSON valide.",
    );
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw validationFailed(parsed.error);
  return parsed.data;
}

export async function readJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  return parseJson(await readJsonText(request), schema);
}

/** Comme readJsonBody, mais un corps absent vaut `{}` (actions sans paramètre obligatoire). */
export async function readJsonBodyOrEmpty<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  const length = request.headers.get("content-length");
  const type = request.headers.get("content-type");
  if (length === "0" || (length === null && type === null)) {
    return parseJson("{}", schema);
  }
  return readJsonBody(request, schema);
}

export function readQuery<T>(url: string, schema: z.ZodType<T>): T {
  const params = Object.fromEntries(new URL(url).searchParams);
  const parsed = schema.safeParse(params);
  if (!parsed.success) {
    throw validationFailed(parsed.error, "Paramètres de requête invalides.");
  }
  return parsed.data;
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token === "" ? null : token;
}
