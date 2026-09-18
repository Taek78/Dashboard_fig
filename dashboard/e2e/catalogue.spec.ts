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
    const remove = page.getByRole("button", { name: "Supprimer ce produit" });
    await expect(remove).toBeVisible();

    // Suppression : une fenêtre de confirmation, « Annuler » ne fait rien.
    await remove.click();
    const dialog = page.getByRole("alertdialog", {
      name: "Supprimer « Carottes (copie) » ?",
    });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Annuler" })).toBeFocused();
    await dialog.getByRole("button", { name: "Annuler" }).click();
    await expect(dialog).toBeHidden();
    await expect(
      page.getByRole("heading", { level: 1, name: "Carottes (copie)" }),
    ).toBeVisible();

    // « Confirmer » supprime la copie et ramène au catalogue.
    await remove.click();
    await dialog.getByRole("button", { name: "Confirmer" }).click();
    await expect(page).toHaveURL(/\/catalogue\?supprime=1$/);
    await page.goto("/catalogue?q=carottes");
    await expect(
      page.getByRole("article", { name: "Produit Carottes (copie)" }),
    ).toHaveCount(0);
  });

  test("le statut est sur l'image ; le paramètre laisse en vente un produit à stock 0", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/catalogue");
    const melon = page.getByRole("article", { name: "Produit Melon" });
    const status = melon.locator("[data-status]");
    await expect(status).toHaveText("Statut : Rupture de stock");
    // Le statut est dans le lien de l'image, pas en pied de carte.
    await expect(
      melon.getByRole("link", { name: "Melon : ouvrir la fiche" }),
    ).toContainText("Rupture de stock");
    await expect(
      page
        .getByRole("article", { name: "Produit Fraises" })
        .locator("[data-status]"),
    ).toHaveText("Statut : Indisponible");
    await expect(
      page
        .getByRole("article", { name: "Produit Carottes" })
        .locator("[data-status]"),
    ).toHaveText("Statut : En vente");

    const setting = page
      .getByRole("form", { name: "Paramètres du catalogue" })
      .getByLabel("Laisser en vente les produits dont le stock est à 0");
    await expect(setting).not.toBeChecked();
    await setting.check();
    await expect(status).toHaveText("Statut : En vente");
    // Base partagée entre les tests : on remet le paramètre.
    await setting.uncheck();
    await expect(status).toHaveText("Statut : Rupture de stock");
  });
});
