import type { Article } from "@/domain/articles/types";

/*
 * Règles pures des articles : tri chronologique, extrait, état de parution.
 * Aucune dépendance à Next ; testées dans test/domain/articles/rules.test.ts.
 */

/** Du plus récent au plus ancien (parution, puis modification, puis titre). */
export function sortArticlesNewestFirst(
  articles: readonly Article[],
): Article[] {
  return articles.toSorted(
    (a, b) =>
      b.publishedAt.localeCompare(a.publishedAt) ||
      b.updatedAt.localeCompare(a.updatedAt) ||
      a.title.localeCompare(b.title, "fr"),
  );
}

/**
 * Début du texte pour une carte : espaces normalisés, coupé au dernier mot
 * entier avant `max` caractères, suivi d'une ellipse s'il a été tronqué.
 */
export function excerpt(text: string, max = 160): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export const PUBLICATION_STATES = ["published", "scheduled", "hidden"] as const;
export type PublicationState = (typeof PUBLICATION_STATES)[number];
export const PUBLICATION_STATE_LABELS: Record<PublicationState, string> = {
  published: "En ligne",
  scheduled: "Programmé",
  hidden: "Masqué",
};

/** Masqué l'emporte ; sinon programmé si la parution est après `today` ; sinon en ligne. */
export function publicationState(
  article: Pick<Article, "visible" | "publishedAt">,
  today: string,
): PublicationState {
  if (!article.visible) return "hidden";
  if (article.publishedAt > today) return "scheduled";
  return "published";
}

/** Paragraphes du corps (séparés par une ligne vide), sans lignes vides. */
export function paragraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}
