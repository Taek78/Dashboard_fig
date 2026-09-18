import { createHash } from "node:crypto";
import {
  PUBLIC_CACHE_MAX_AGE_S,
  PUBLIC_CACHE_STALE_S,
} from "@/domain/api/types";

/*
 * Cache des lectures PUBLIQUES de l'API (catalogue, articles, communautés) :
 * un ETag faible calculé sur le corps sérialisé, et un `Cache-Control` qui
 * laisse un cache intermédiaire ou l'application resservir la réponse une
 * minute, puis la revalider pendant cinq. Une application qui renvoie
 * `If-None-Match` reçoit 304 sans corps quand rien n'a changé.
 */
export const PUBLIC_CACHE = `public, max-age=${PUBLIC_CACHE_MAX_AGE_S}, stale-while-revalidate=${PUBLIC_CACHE_STALE_S}`;

export function etagOf(text: string): string {
  return `W/"${createHash("sha256").update(text, "utf8").digest("hex").slice(0, 32)}"`;
}

/** Vrai si l'en-tête If-None-Match (une liste, ou « * ») contient l'ETag. */
export function etagMatches(ifNoneMatch: string | null, etag: string): boolean {
  if (ifNoneMatch === null) return false;
  if (ifNoneMatch.trim() === "*") return true;
  const bare = etag.replace(/^W\//, "");
  return ifNoneMatch
    .split(",")
    .map((value) => value.trim().replace(/^W\//, ""))
    .includes(bare);
}
