import { expect, test } from "@playwright/test";
import { E2E_ACCOUNTS } from "../playwright.config";
import { login } from "./helpers";

test.describe("catalogue", () => {
  test("dupliquer depuis la carte crée une copie masquée, modifiable sur sa fiche", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/catalogue?q=carottes");
    const card = page.getByRole("article", { name: "Produit Carottes" });
    await expect(card.getByRole("link", { name: "Modifier" })).toBeVisible();
    await card.getByRole("button", { name: "Dupliquer" }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: "Carottes (copie)" }),
    ).toBeVisible();
    await expect(page.getByRole("status").first()).toContainText(
      "Copie créée, masquée dans l'application",
    );
    await expect(
      page.getByLabel("Visible dans l'application"),
    ).not.toBeChecked();
    await expect(
      page.getByRole("button", { name: "Dupliquer ce produit" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Supprimer ce produit" }),
    ).toBeVisible();
  });
});
