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

    await page.getByLabel("Nouveau statut").selectOption("preparing");
    await page.getByRole("button", { name: "Changer le statut" }).click();
    await expect(page.getByRole("status").first()).toContainText(
      "Statut mis à jour : En préparation.",
    );

    const history = page.getByRole("region", { name: "Historique" });
    await expect(history).toContainText("En préparation");
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
    expect(values).toEqual(["preparing", "cancelled"]);
  });
});

test.describe("commandes : cartes et annulation", () => {
  test("annuler depuis la carte exige un motif, affiché ensuite sur la carte", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    // Le jour du scénario : une fois annulée, la carte resterait absente d'une
    // liste filtrée sur « en attente », et la liste complète est paginée.
    await page.goto("/commandes?date=2026-09-08");
    const card = page.getByRole("article", {
      name: /^Commande FIG-260907-006,/,
    });
    await expect(
      card.getByRole("button", { name: "Passer en préparation" }),
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

test.describe("commandes : recherche et filtres", () => {
  test("la recherche se lance pendant la saisie et retrouve les commandes du client sur une période", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/commandes");
    const form = page.getByRole("form", {
      name: "Recherche et filtres des commandes",
    });
    await form.getByLabel("Livraison du").fill("2026-09-05");
    await form.getByLabel("Livraison au").fill("2026-09-09");
    // Frappe rapide, sans bouton : une seule recherche part après l'anti-rebond,
    // et la saisie n'est jamais écrasée par une réponse intermédiaire.
    const search = form.getByLabel("Rechercher une commande");
    await search.pressSequentially("benali", { delay: 60 });

    await expect(page).toHaveURL(/q=benali/);
    await expect(page).toHaveURL(/du=2026-09-05/);
    await expect(search).toHaveValue("benali");
    await expect(search).toBeFocused();
    await expect(page.getByRole("status").first()).toContainText(
      /2\scommandes/,
    );
    await expect(
      page.getByRole("link", { name: "FIG-260907-001" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "FIG-260907-008" }),
    ).toBeVisible();
  });

  test("le filtre préparateur garde ses commandes, « Réinitialiser » rend la liste complète", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/commandes?du=2026-09-05&au=2026-09-09");
    const form = page.getByRole("form", {
      name: "Recherche et filtres des commandes",
    });
    await form
      .getByLabel("Préparateur")
      .selectOption({ label: "Julien Carpentier" });

    await expect(page).toHaveURL(/preparateur=stf-0005/);
    await expect(page.getByRole("status").first()).toContainText(
      /4\scommandes/,
    );
    await page.getByRole("link", { name: "Réinitialiser" }).click();
    await expect(page).toHaveURL(/\/commandes$/);
    // Navigation extérieure : les champs reprennent les valeurs de l'URL.
    await expect(form.getByLabel("Préparateur")).toHaveValue("");
    await expect(form.getByLabel("Livraison du")).toHaveValue("");
  });
});
