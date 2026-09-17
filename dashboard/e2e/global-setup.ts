import { rm } from "node:fs/promises";
import { E2E_MAIL_DIR } from "../playwright.config";
import setup from "../test/support/global-setup";

/*
 * Avant la suite navigateur : migrations et seed de la base de test (mêmes
 * données et mêmes comptes que Vitest), puis le dossier des mails du transport
 * « fichier » est vidé : chaque exécution lit ses propres codes et liens.
 * Les parcours écrivent dans la base (statuts, articles…) : chaque exécution
 * repart ainsi des fixtures.
 */
export default async function globalSetup(): Promise<void> {
  await setup();
  await rm(E2E_MAIL_DIR, { recursive: true, force: true });
}
