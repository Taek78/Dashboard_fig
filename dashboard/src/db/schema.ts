/*
 * Schéma Drizzle de la base du CLIENT.
 *
 * Volontairement vide en B1 : le schéma sera obtenu par `npx drizzle-kit pull`
 * (introspection, B2) sur un compte lecture seule, puis copié ici. Ne rien
 * déclarer à la main : la base appartient au client, le dashboard la lit telle
 * qu'elle est. Aucune migration vers elle sans accord écrit (backlog, Q4).
 *
 * Note : `pull` écrit dans ./drizzle/ (le `out` de drizzle.config.ts), pas ici.
 */
export {};
