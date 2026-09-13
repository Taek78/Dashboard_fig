import type { Article } from "@/domain/articles/types";

/*
 * Articles factices : textes rédigés pour la démo, aucune personne réelle.
 * Déterministes (dates fixes). Un article masqué et un article programmé
 * (daté après le 13 septembre 2026) pour exercer les états.
 */
const UPDATED = "2026-09-06T18:00:00.000Z";

type Seed = Omit<Article, "updatedAt" | "imageUrl" | "visible"> &
  Partial<Pick<Article, "updatedAt" | "imageUrl" | "visible">>;

const a = (seed: Seed): Article => ({
  imageUrl: null,
  visible: true,
  updatedAt: UPDATED,
  ...seed,
});

export const articlesFixtures: readonly Article[] = [
  a({
    id: "art-0001",
    title: "Cinq fruits et légumes par jour : par où commencer ?",
    category: "nutrition",
    illustration: "🥗",
    publishedAt: "2026-09-10",
    body: "Une portion, c'est à peu près la taille d'un poing : une pomme, deux abricots, une poignée de haricots verts. Répartir les portions sur la journée est plus facile que de tout concentrer au dîner.\n\nCommencez par ajouter un fruit au petit-déjeuner et des crudités en entrée : deux portions sans changer vos habitudes.",
  }),
  a({
    id: "art-0002",
    title: "Recette : poêlée de légumes de fin d'été",
    category: "recipe",
    illustration: "🍲",
    publishedAt: "2026-09-02",
    body: "Pour quatre personnes : deux courgettes, un poivron, deux tomates, un oignon, une gousse d'ail, huile d'olive, thym.\n\nFaites revenir l'oignon et l'ail, ajoutez le poivron puis les courgettes en dés, et enfin les tomates. Vingt minutes à feu doux, sel, poivre, thym. Servez avec un filet d'huile d'olive crue.",
  }),
  a({
    id: "art-0003",
    title: "Pourquoi les carottes de saison ont-elles plus de goût ?",
    category: "science",
    illustration: "🔬",
    publishedAt: "2026-08-20",
    body: "La teneur en sucres et en composés aromatiques d'une carotte dépend de sa variété, de la maturité à la récolte et du temps passé entre le champ et l'assiette.\n\nRécoltée à maturité et consommée dans la semaine, une carotte de plein champ conserve l'essentiel de ses arômes ; le stockage prolongé au froid les atténue.",
  }),
  a({
    id: "art-0004",
    title: "Prunes et mirabelles : la récolte 2026 en avance",
    category: "news",
    illustration: "📰",
    publishedAt: "2026-08-05",
    body: "Le printemps doux a avancé la floraison de dix jours dans le Sud-Ouest et en Lorraine. Les premières mirabelles arrivent début août, avec des calibres réguliers.\n\nNos producteurs partenaires prévoient une saison courte : profitez-en dès maintenant.",
  }),
  a({
    id: "art-0005",
    title: "Conserver ses légumes plus longtemps",
    category: "nutrition",
    illustration: "🥕",
    publishedAt: "2026-07-15",
    body: "Les tomates se gardent à température ambiante, jamais au réfrigérateur : le froid casse leurs arômes. Les carottes et radis, eux, préfèrent le bac à légumes, fanes coupées.\n\nLes pommes de terre et les oignons se conservent au sec et à l'abri de la lumière, mais séparément.",
  }),
  a({
    id: "art-0006",
    title: "Recette d'hiver : soupe de potimarron",
    category: "recipe",
    illustration: "🥣",
    publishedAt: "2026-06-28",
    visible: false,
    body: "Brouillon à republier à l'automne. Un potimarron, un oignon, un litre de bouillon, une pointe de muscade. Cuire trente minutes, mixer, servir avec des graines de courge grillées.",
  }),
  a({
    id: "art-0007",
    title: "Les pommes de la rentrée : variétés et usages",
    category: "nutrition",
    illustration: "🍎",
    publishedAt: "2026-09-20",
    body: "Gala pour croquer, Reinette pour les tartes, Granny pour les salades : chaque variété a son usage.\n\nÀ la rentrée, les premières récoltes sont acidulées ; les pommes de garde s'adoucissent avec les semaines.",
  }),
];
