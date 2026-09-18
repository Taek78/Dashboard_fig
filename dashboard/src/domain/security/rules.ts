import {
  describeSecurityEvent,
  familyOf,
  metaOf,
  type SecurityFamily,
} from "@/domain/security/events";
import type {
  SecurityEventRecord,
  SecurityFilters,
} from "@/domain/security/types";
import { normalize } from "@/lib/text";

/*
 * Règles pures du journal : ce que la base reproduit en SQL, et ce que le
 * test de parité compare ligne à ligne (test/data/security-log.db.test.ts).
 * La recherche libre suit la même discipline que celle des commandes : on
 * normalise (sans casse ni accent) des deux côtés, et la base applique la
 * MÊME règle avec fig_normalize.
 */

/**
 * Ce sur quoi la recherche libre porte : le type BRUT (`login_failure`) et les
 * VALEURS des détails, jamais leurs clés ni le libellé français. C'est ce que
 * la base sait reproduire exactement (`jsonb_each_text`), donc ce sur quoi la
 * parité peut être testée ; pour chercher par famille, les cases à cocher sont
 * là. Les valeurs nulles sont ignorées des deux côtés.
 */
export function searchTextOf(event: SecurityEventRecord): string {
  const details = Object.values(event.details)
    .filter((value) => value !== null && typeof value !== "object")
    .map(String);
  return [event.type, ...details].join(" ");
}

export function matchesSecurityQuery(
  event: SecurityEventRecord,
  query: string,
): boolean {
  const needle = normalize(query.trim());
  if (needle === "") return true;
  return normalize(searchTextOf(event)).includes(needle);
}

/** Le jour du journal (`AAAA-MM-JJ`), pour comparer aux bornes de la période. */
export function dayOf(event: SecurityEventRecord): string {
  return event.at.slice(0, 10);
}

export function matchesSecurityFilters(
  event: SecurityEventRecord,
  filters: SecurityFilters,
): boolean {
  if (
    filters.query !== undefined &&
    !matchesSecurityQuery(event, filters.query)
  )
    return false;
  if (filters.families !== undefined) {
    // Un type inconnu n'appartient à aucune famille : cocher une famille ne le
    // fait pas remonter, exactement comme la requête SQL.
    const family = familyOf(event.type);
    if (family === null || !filters.families.includes(family)) return false;
  }
  const day = dayOf(event);
  if (filters.from !== undefined && day < filters.from) return false;
  if (filters.to !== undefined && day > filters.to) return false;
  return true;
}

export function hasSecurityFilters(filters: SecurityFilters): boolean {
  return (
    filters.query !== undefined ||
    filters.families !== undefined ||
    filters.from !== undefined ||
    filters.to !== undefined
  );
}

/** Filtres → paramètres d'URL, avec les clés françaises que le schéma relit. */
export function securityFiltersQuery(filters: SecurityFilters): string {
  const params = new URLSearchParams();
  if (filters.query !== undefined) params.set("q", filters.query);
  for (const family of filters.families ?? []) params.append("famille", family);
  if (filters.from !== undefined) params.set("du", filters.from);
  if (filters.to !== undefined) params.set("au", filters.to);
  return params.toString();
}

/**
 * Copie triée telle que l'écran l'affiche : le plus récent en tête, et
 * l'identifiant départage deux événements du même instant (deux écritures dans
 * la même transaction), pour un ordre identique à chaque lecture.
 */
export function sortSecurityEvents(
  events: readonly SecurityEventRecord[],
): SecurityEventRecord[] {
  return [...events].sort(
    (a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id),
  );
}

/** Une ligne prête à afficher : pastille, phrase, et le type brut en secours. */
export type SecurityEventView = {
  id: string;
  at: string;
  type: string;
  label: string;
  family: SecurityFamily | null;
  tone: ReturnType<typeof metaOf>["tone"];
  description: string;
};

export function securityEventView(
  event: SecurityEventRecord,
): SecurityEventView {
  const meta = metaOf(event.type);
  return {
    id: event.id,
    at: event.at,
    type: event.type,
    label: meta.label,
    family: meta.family,
    tone: meta.tone,
    description: describeSecurityEvent(event.type, event.details),
  };
}
