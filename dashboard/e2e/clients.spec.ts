import { expect, test } from "@playwright/test";
import { E2E_ACCOUNTS } from "../playwright.config";
import { login } from "./helpers";

test.describe("clients", () => {
  test("les particuliers portent leur fidélité, les communautés leur remise", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/clients?q=benali");
    await expect(page.getByRole("status").first()).toContainText("1 client");
    await expect(
      page.getByRole("columnheader", { name: "Fidélité" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Amel Benali" }).click();
    await expect(
      page.getByRole("heading", { level: 2, name: "Fidélité" }),
    ).toBeVisible();
    await expect(page.getByText(/d'affilée/).first()).toBeVisible();

    await page.goto("/clients?type=communautes");
    const card = page.getByRole("article", {
      name: "Communauté Crèche Les Lucioles",
    });
    await expect(card).toContainText("−10 % sur chaque commande");
    await card.getByRole("link", { name: "Membres et commandes" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Crèche Les Lucioles" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "Membres" }),
    ).toBeVisible();
  });
});
