import { expect, test } from "@playwright/test";
import { E2E_ACCOUNTS } from "../playwright.config";
import { login } from "./helpers";

test.describe("commandes", () => {
  test("la liste mène au détail, et le changement de statut laisse une trace", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/commandes?statut=pending");
    await page.getByRole("link", { name: "FIG-260907-001" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Commande FIG-260907-001" }),
    ).toBeVisible();

    await page.getByLabel("Nouveau statut").selectOption("confirmed");
    await page.getByRole("button", { name: "Changer le statut" }).click();
    await expect(page.getByRole("status").first()).toContainText(
      "Statut mis à jour : Confirmée.",
    );

    const history = page.getByRole("region", { name: "Historique" });
    await expect(history).toContainText("Confirmée");
    await expect(history).toContainText("(depuis en attente)");
    await expect(history).toContainText(E2E_ACCOUNTS.manager.name);
  });

  test("un statut hors liste blanche n'est pas proposé", async ({ page }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/commandes/cmd-0009");
    const select = page.getByLabel("Nouveau statut");
    const values = await select
      .locator("option")
      .evaluateAll((options) =>
        options.map((o) => (o as HTMLOptionElement).value).filter(Boolean),
      );
    expect(values).toEqual(["confirmed", "cancelled"]);
  });
});

test.describe("commandes : cartes et annulation", () => {
  test("annuler depuis la carte exige un motif, affiché ensuite sur la carte", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    // Liste complète : une fois annulée, la carte resterait absente d'une liste
    // filtrée sur « en attente ».
    await page.goto("/commandes");
    const card = page.getByRole("article", {
      name: /^Commande FIG-260907-006,/,
    });
    await expect(
      card.getByRole("button", { name: "Confirmer la commande" }),
    ).toBeVisible();
    await card.getByRole("button", { name: "Annuler la commande" }).click();
    const panel = card.getByRole("group", {
      name: "Annulation de la commande",
    });
    await panel.getByLabel("Motif communiqué au client").selectOption("other");
    await panel.getByLabel("Précision").fill("Client absent, injoignable");
    await expect(panel).toContainText("26 / 100 caractères");
    await panel.getByRole("button", { name: "Confirmer l'annulation" }).click();
    await expect(card).toContainText("Annulée");
    await expect(card).toContainText("Autre : Client absent, injoignable");

    await page.goto("/commandes/cmd-0010");
    await expect(page.getByText("Motif communiqué au client :")).toContainText(
      "Autre : Client absent, injoignable",
    );
    await expect(
      page.getByRole("region", { name: "Historique" }),
    ).toContainText("Motif : Autre : Client absent, injoignable");
  });
});
