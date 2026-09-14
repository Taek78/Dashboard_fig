/*
 * Vocabulaire du catalogue : clés anglaises (code), libellés français (interface).
 * Même patron que ORDER_STATUSES : une seule liste par notion, tsc force le reste
 * à suivre. Vocabulaire à confirmer avec le client (question 9).
 */
export const PRODUCT_CATEGORIES = ["fruit", "vegetable"] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];
export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  fruit: "Fruit",
  vegetable: "Légume",
};

export const CONTAINERS = ["none", "tray", "parcel", "crate", "bag"] as const;
export type Container = (typeof CONTAINERS)[number];
export const CONTAINER_LABELS: Record<Container, string> = {
  none: "Sans contenant",
  tray: "Plateau",
  parcel: "Colis",
  crate: "Caisse",
  bag: "Sac",
};

/** Pays d'origine proposés (ISO 3166-1 alpha-2). "XX" : autre, précisé en région. */
export const ORIGIN_COUNTRIES = {
  FR: "France",
  ES: "Espagne",
  IT: "Italie",
  PT: "Portugal",
  BE: "Belgique",
  NL: "Pays-Bas",
  DE: "Allemagne",
  MA: "Maroc",
  PE: "Pérou",
  CR: "Costa Rica",
  EC: "Équateur",
  ZA: "Afrique du Sud",
  XX: "Autre",
} as const;
export type OriginCountry = keyof typeof ORIGIN_COUNTRIES;
export const ORIGIN_COUNTRY_CODES = Object.keys(
  ORIGIN_COUNTRIES,
) as OriginCountry[];

/** Un produit est « local » quand il vient de France : petit drapeau rond sur la carte. */
export const LOCAL_COUNTRY: OriginCountry = "FR";

/**
 * Illustrations disponibles pour une carte : des emojis, choisis dans un
 * sélecteur. Pas de fichier à héberger, lisibles partout, remplaçables par une
 * URL d'image (imageUrl) quand le client fournira ses visuels.
 */
export const ILLUSTRATIONS = [
  "🥕",
  "🍎",
  "🍌",
  "🍅",
  "🥒",
  "🥬",
  "🥑",
  "🍋",
  "🍓",
  "🥔",
  "🧅",
  "🌱",
  "🍈",
  "🍇",
  "🫑",
  "🍐",
  "🍑",
  "🍒",
  "🍊",
  "🥦",
  "🌽",
  "🍆",
  "🧄",
  "🫐",
  "🍍",
  "🥝",
  "🥭",
  "🍠",
  "🌶️",
  "🍄",
] as const;
export type Illustration = (typeof ILLUSTRATIONS)[number];
export const DEFAULT_ILLUSTRATION: Record<ProductCategory, Illustration> = {
  fruit: "🍎",
  vegetable: "🥬",
};
