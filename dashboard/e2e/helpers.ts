import { expect, type Page } from "@playwright/test";

export type Account = { email: string; password: string; name: string };

/** Se connecte par le formulaire et attend d'être sur le back-office. */
export async function login(page: Page, account: Account): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel("E-mail").fill(account.email);
  await page.getByLabel("Mot de passe").fill(account.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/(\?.*)?$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Tableau de bord" }),
  ).toBeVisible();
}
