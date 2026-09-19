import { expect, test } from "@playwright/test";
import { E2E_ACCOUNTS } from "../playwright.config";
import { login } from "./helpers";

/*
 * Remboursement ou avoir d'une commande annulée (demande du 2026-09-19) :
 * l'équipe l'enregistre sur la fiche, le badge se voit sur la fiche et la
 * carte, le statut est verrouillé tant qu'il n'est pas retiré. cmd-0006 :
 * commande annulée du scénario ; le test la remet dans son état initial.
 */
test("avoir partiel sur une commande annulée : badge, carte colorée, statut verrouillé, puis retrait", async ({
  page,
}) => {
  await login(page, E2E_ACCOUNTS.manager);
  await page.goto("/commandes/cmd-0006");
  const section = page.getByRole("region", {
    name: "Remboursement ou avoir",
  });
  await expect(section).toContainText("Aucun remboursement ni avoir");
  await section.getByText("Avoir", { exact: true }).click();
  await section.getByLabel("Montant (€)").fill("2,00");
  await section.getByRole("button", { name: "Enregistrer" }).click();
  await expect(section).toContainText("Avoir enregistré");
  await expect(section).toContainText("Avoir partiel");
  await expect(page.locator('[data-refund="credit"]').first()).toContainText(
    "Avoir",
  );
  await expect(page.getByText("Statut verrouillé")).toBeVisible();
  await expect(page.getByLabel("Statut de la commande")).toHaveCount(0);

  // Dans la liste, la carte porte le badge et la couleur de l'avoir.
  const reference = (await page
    .getByRole("heading", { level: 1 })
    .textContent())!.match(/FIG-\d{6}-\d{3}/)?.[0];
  expect(reference).toBeTruthy();
  await page.goto(`/commandes?q=${reference}`);
  const card = page.getByRole("article").filter({ hasText: reference! });
  await expect(card.locator('[data-refund="credit"]')).toBeVisible();
  await expect(card).toHaveClass(/border-l-credit/);

  // Retrait : le statut redevient modifiable.
  await page.goto("/commandes/cmd-0006");
  await section.getByRole("button", { name: "Retirer l'avoir" }).click();
  await expect(section).toContainText("Aucun remboursement ni avoir");
  await expect(page.getByText("Statut verrouillé")).toHaveCount(0);
});

test("le livreur ne voit pas le formulaire de remboursement", async ({
  page,
}) => {
  await login(page, E2E_ACCOUNTS.driver);
  await page.goto("/commandes/cmd-0006");
  await expect(
    page.getByRole("region", { name: "Remboursement ou avoir" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Enregistrer" })).toHaveCount(
    0,
  );
});

test("métriques : section « Remboursements et avoirs » en pourcentage", async ({
  page,
}) => {
  await login(page, E2E_ACCOUNTS.admin);
  await page.goto("/metriques?periode=ce-mois");
  const refunds = page.getByRole("region", {
    name: "Remboursements et avoirs",
  });
  await expect(refunds).toContainText("Commandes remboursées");
  await expect(refunds).toContainText("Commandes en avoir");
  await expect(refunds).toContainText("%");
  await expect(
    refunds.getByRole("img", { name: /part des commandes remboursées/ }),
  ).toBeVisible();
});
