/*
 * Catégories du catalogue : clés anglaises (code), libellés français (interface).
 * Même patron que ORDER_STATUSES : une seule liste, tsc force le reste à suivre.
 * Vocabulaire provisoire, à aligner sur celui du client (question Q9).
 */
export const PRODUCT_CATEGORIES = [
  "fruits",
  "vegetables",
  "herbs",
  "other",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  fruits: "Fruits",
  vegetables: "Légumes",
  herbs: "Herbes",
  other: "Autres",
};
