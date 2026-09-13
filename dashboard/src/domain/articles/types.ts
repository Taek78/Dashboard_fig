import type {
  ArticleCategory,
  ArticleIllustration,
} from "@/domain/articles/category";

/*
 * Article « à lire » publié dans l'application FIG : conseil d'alimentation,
 * recette, article scientifique ou actualité agroalimentaire. Le corps est du
 * texte brut (paragraphes séparés par une ligne vide) : pas de HTML à assainir.
 * `publishedAt` est un jour (AAAA-MM-JJ) : un article daté dans le futur est
 * « programmé ». `visible` permet de retirer un article sans le supprimer.
 */
export type Article = {
  id: string;
  title: string;
  body: string;
  category: ArticleCategory;
  illustration: ArticleIllustration;
  /** Image du client (https) ; remplace l'illustration quand elle est renseignée. */
  imageUrl: string | null;
  /** Jour de parution, AAAA-MM-JJ. */
  publishedAt: string;
  visible: boolean;
  updatedAt: string;
};

/** Ce que le formulaire fournit : tout sauf l'identité et l'horodatage. */
export type ArticleInput = Omit<Article, "id" | "updatedAt">;
