import { expect, type Page } from "@playwright/test";
import { E2E_ACCOUNTS } from "../playwright.config";

export type Account = (typeof E2E_ACCOUNTS)[keyof typeof E2E_ACCOUNTS];

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
