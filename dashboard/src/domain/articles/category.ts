/*
 * Vocabulaire des articles « à lire » de l'application : clés anglaises (code),
 * libellés français (interface). Même patron que PRODUCT_CATEGORIES.
 */
export const ARTICLE_CATEGORIES = [
  "nutrition",
  "recipe",
  "science",
  "news",
] as const;
export type ArticleCategory = (typeof ARTICLE_CATEGORIES)[number];
export const ARTICLE_CATEGORY_LABELS: Record<ArticleCategory, string> = {
  nutrition: "Conseil alimentation",
  recipe: "Recette",
  science: "Article scientifique",
  news: "Actualité agroalimentaire",
};

/**
 * Illustrations proposées : des emojis choisis dans un sélecteur, remplaçables
 * par une URL d'image (imageUrl) quand le client fournira ses visuels.
 */
export const ARTICLE_ILLUSTRATIONS = [
  "🥗",
  "🍲",
  "🔬",
  "📰",
  "🥕",
  "🍎",
  "🥦",
  "🍓",
  "🍅",
  "🌱",
  "🧑‍🍳",
  "📚",
  "🌍",
  "🚜",
  "🧃",
  "🥣",
] as const;
export type ArticleIllustration = (typeof ARTICLE_ILLUSTRATIONS)[number];
export const DEFAULT_ARTICLE_ILLUSTRATION: Record<
  ArticleCategory,
  ArticleIllustration
> = {
  nutrition: "🥗",
  recipe: "🍲",
  science: "🔬",
  news: "📰",
};
