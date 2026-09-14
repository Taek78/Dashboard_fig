import { expect, test } from "@playwright/test";
import { E2E_ACCOUNTS } from "../playwright.config";
import { login } from "./helpers";

test.describe("personnel", () => {
  test("ajouter un livreur, puis l'affecter à une commande depuis sa carte", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/personnel?type=livreur");
    await expect(
      page.getByRole("link", { name: /Toute l'équipe/ }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Nouvelle personne" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Nouvelle personne" }),
    ).toBeVisible();

    const stamp = Date.now();
    await page.getByLabel("Prénom").fill("Nour");
    await page.getByLabel("Nom", { exact: true }).fill(`Sassi ${stamp}`);
    await page.getByLabel("E-mail").fill(`nour.${stamp}@fig-demo.invalid`);
    await page.getByLabel("Téléphone").fill("06 39 98 90 50");
    await page.getByLabel("Date d'entrée").fill("2026-09-14");
    await page.getByLabel("Samedi").check();
    await page.getByRole("button", { name: "Ajouter à l'équipe" }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: `Nour Sassi ${stamp}` }),
    ).toBeVisible();
    await expect(page.getByRole("status").first()).toContainText(
      "Personne ajoutée à l'équipe.",
    );
    await expect(page.getByText("Aucune commande affectée")).toBeVisible();

    // Affectation depuis la carte de commande : le choix écrit aussitôt.
    await page.goto("/commandes?date=2026-09-08");
    const card = page.getByRole("article", {
      name: /^Commande FIG-260907-005,/,
    });
    const field = card.getByRole("form", { name: "Affectation : Livreur" });
    await field
      .getByLabel("Livreur")
      .selectOption({ label: `Nour Sassi ${stamp}` });
    await expect(field.getByRole("status")).toContainText(
      `Livreur : Nour Sassi ${stamp}.`,
    );

    // L'historique de la personne la retrouve.
    await page.goto("/personnel");
    await page
      .getByRole("link", { name: `Nour Sassi ${stamp}` })
      .first()
      .click();
    await expect(
      page.getByRole("heading", { level: 2, name: "Historique de traitement" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "FIG-260907-005" }),
    ).toBeVisible();
  });

  test("l'onglet des gestionnaires renvoie vers les comptes", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/personnel?type=gestionnaire");
    await expect(page.getByText("se gère dans")).toBeVisible();
    await expect(page.getByRole("link", { name: "Comptes" })).toBeVisible();
  });
});
