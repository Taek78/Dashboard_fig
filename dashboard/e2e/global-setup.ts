/*
 * Avant la suite navigateur : migrations et seed de la base de test (mêmes
 * données et mêmes comptes que Vitest). Les parcours écrivent dans la base
 * (statuts, articles…) : chaque exécution repart ainsi des fixtures.
 */
export { default } from "../test/support/global-setup";
