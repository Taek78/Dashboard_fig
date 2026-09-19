import { expect, type Page } from "@playwright/test";

export type Account = { email: string; password: string; name: string };

/** Se connecte par le formulaire et attend d'être sur le back-office. */
export async function login(page: Page, account: Account): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel("E-mail").fill(account.email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/(\?.*)?$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Tableau de bord" }),
  ).toBeVisible();
}

/**
 * Déroule le panneau des filtres de la page (replié par défaut) : clique
 * chaque bouton « Filtres » encore fermé.
 */
export async function openFilters(page: Page): Promise<void> {
  const closed = page.locator('button[aria-expanded="false"]', {
    hasText: "Filtres",
  });
  const count = await closed.count();
  for (let i = 0; i < count; i += 1) {
    await closed.first().click();
  }
}
