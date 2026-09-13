import { expect, test } from "@playwright/test";
import { E2E_ACCOUNTS } from "../playwright.config";
import { login } from "./helpers";

test.describe("tournée", () => {
  test("le geste suivant fait avancer une livraison en un bouton", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.admin);
    await page.goto("/livraisons?date=2026-09-07");
    await expect(
      page.getByRole("progressbar", { name: "Avancement de la tournée" }),
    ).toBeVisible();

    const card = page.getByRole("article", { name: /FIG-260907-002$/ });
    await expect(card).toContainText("Confirmée");
    await expect(
      card.getByRole("link", { name: /Itinéraire/ }),
    ).toHaveAttribute("href", /google\.com\/maps/);
    await card.getByRole("button", { name: "Passer en préparation" }).click();
    await expect(card).toContainText("En préparation");
    await expect(
      card.getByRole("button", { name: "Démarrer la livraison" }),
    ).toBeVisible();
  });

  test("la première livraison non terminée est signalée comme prochaine", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.admin);
    await page.goto("/livraisons?date=2026-09-07");
    const first = page.getByRole("article", { name: /^Livraison 1,/ });
    await expect(first).toContainText("Prochaine");
  });
});
