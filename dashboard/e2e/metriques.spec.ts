import { expect, test } from "@playwright/test";
import { E2E_ACCOUNTS } from "../playwright.config";
import { login } from "./helpers";

test.describe("métriques", () => {
  test("rangées par thème, le graphe change de mesure", async ({ page }) => {
    await login(page, E2E_ACCOUNTS.admin);
    await page.goto("/metriques?periode=ce-mois");
    for (const heading of ["Ventes", "Commandes", "Produits"]) {
      await expect(
        page.getByRole("heading", { level: 2, name: heading, exact: true }),
      ).toBeVisible();
    }
    const picker = page.getByRole("group", { name: "Mesure affichée" });
    await expect(
      picker.getByRole("button", { name: "Chiffre d'affaires" }),
    ).toHaveAttribute("aria-pressed", "true");
    await picker.getByRole("button", { name: "Commandes" }).click();
    await expect(
      picker.getByRole("button", { name: "Commandes" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".sr-only > table caption")).toContainText(
      "Commandes par période",
    );
  });

  test("les ratios sont des camemberts pleins, la part survolée dit ce qu'elle représente", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.admin);
    await page.goto("/metriques?periode=ce-mois");
    for (const name of [
      /part des téléchargements devenus inscriptions/,
      /part des inscrits ayant commandé/,
      /part des commandes annulées/,
      /commandes de communautés et de particuliers/,
    ]) {
      await expect(page.getByRole("img", { name })).toBeVisible();
    }
    await expect(page.getByText("Commandes communauté")).toBeVisible();

    const pie = page.getByRole("img", {
      name: /commandes de communautés et de particuliers/,
    });
    await pie.locator("path").first().hover();
    await expect(page.getByRole("tooltip")).toContainText(
      /Communautés|Particuliers/,
    );
  });
});
