import { expect, test } from "@playwright/test";
import { E2E_ACCOUNTS } from "../playwright.config";
import { login } from "./helpers";

test.describe("navigation mobile", () => {
  test.use({ viewport: { width: 400, height: 860 } });

  test("le menu s'ouvre en panneau, rangé par groupe, et se ferme après un choix", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.admin);
    await page.getByRole("button", { name: "Ouvrir le menu" }).click();
    const nav = page.getByRole("navigation", {
      name: "Navigation principale",
    });
    await expect(nav).toBeVisible();
    for (const group of [
      "Activité",
      "Offre",
      "Clients et équipe",
      "Pilotage",
    ]) {
      await expect(nav.getByText(group, { exact: true })).toBeVisible();
    }
    await nav.getByRole("link", { name: "Commandes" }).click();
    await expect(page).toHaveURL(/\/commandes$/);
    await expect(nav).toBeHidden();
  });

  test("le graphe d'évolution montre toutes ses mesures sans défilement", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.admin);
    await page.goto("/metriques?periode=ce-mois");
    const picker = page.getByRole("group", { name: "Mesure affichée" });
    await picker.scrollIntoViewIfNeeded();
    for (const name of ["Chiffre d'affaires", "Commandes", "Acheteurs"]) {
      await expect(picker.getByRole("button", { name })).toBeInViewport();
    }
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });
});
