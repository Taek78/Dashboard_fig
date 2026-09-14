import { expect, test } from "@playwright/test";
import { E2E_ACCOUNTS } from "../playwright.config";
import { login } from "./helpers";

test.describe("métriques", () => {
  test("le graphe change de mesure et les ratios ont leur camembert", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.admin);
    await page.goto("/metriques?periode=ce-mois");
    const picker = page.getByRole("group", { name: "Mesure affichée" });
    await expect(
      picker.getByRole("button", { name: "Chiffre d'affaires" }),
    ).toHaveAttribute("aria-pressed", "true");
    await picker.getByRole("button", { name: "Commandes" }).click();
    await expect(
      picker.getByRole("button", { name: "Commandes" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("table.sr-only caption")).toContainText(
      "Commandes par période",
    );

    await expect(
      page.getByRole("img", {
        name: /part des téléchargements devenus inscriptions/,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("img", { name: /part des inscrits ayant commandé/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("img", { name: /part des commandes annulées/ }),
    ).toBeVisible();
  });
});
