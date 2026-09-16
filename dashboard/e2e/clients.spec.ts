import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { E2E_ACCOUNTS } from "../playwright.config";
import { login } from "./helpers";

test.describe("clients", () => {
  test("la recherche commune trouve un particulier, sa carte mène à la fiche", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/clients");
    const form = page.getByRole("form", { name: "Recherche de clients" });
    await form
      .getByLabel("Rechercher un client ou une communauté")
      .fill("amel benali");

    await expect(page).toHaveURL(/q=amel/);
    const card = page.getByRole("article", { name: "Client Amel Benali" });
    await expect(card).toContainText("Particulier");
    await expect(card).toContainText("Commandes");
    await card.getByRole("link", { name: /Voir le détail/ }).click();
    await expect(
      page.getByRole("heading", { level: 2, name: "Fidélité" }),
    ).toBeVisible();
    await expect(page.getByText(/d'affilée/).first()).toBeVisible();
  });

  test("l'historique d'une fiche client se restreint à une période de livraison", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/clients/cli-0001");
    const period = page.getByRole("form", { name: "Période de l'historique" });
    await period.getByLabel("Livraison du").fill("2026-09-05");
    await period.getByLabel("Livraison au").fill("2026-09-09");

    await expect(page).toHaveURL(/du=2026-09-05/);
    await expect(page).toHaveURL(/au=2026-09-09/);
    const status = page.getByRole("status").filter({ hasText: "livraison" });
    await expect(status).toContainText("2 commandes sur");
    await expect(status).toContainText("du sam. 5 sept. au mer. 9 sept.");
    await expect(page.getByRole("link", { name: /FIG-/ })).toHaveCount(2);

    await period.getByRole("link", { name: "Toutes les dates" }).click();
    await expect(page).not.toHaveURL(/du=/);
    await expect(period.getByLabel("Livraison du")).toHaveValue("");
  });

  test("RGPD : l'administrateur exporte les données d'un client puis l'anonymise", async ({
    page,
  }) => {
    // Client généré qu'aucun autre parcours n'utilise : l'anonymisation reste en base.
    await login(page, E2E_ACCOUNTS.admin);
    await page.goto("/clients/cli-g-001");
    await expect(
      page.getByRole("heading", { level: 1, name: "Noah Okafor" }),
    ).toBeVisible();
    const panel = page.locator("#donnees-personnelles");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      panel.getByRole("link", { name: "Exporter les données" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(
      /^fig-client-cli-g-001-\d{4}-\d{2}-\d{2}\.json$/,
    );
    const exported = JSON.parse(await readFile(await download.path(), "utf8"));
    expect(exported.format).toBe("fig-donnees-client/1");
    expect(exported.customer.fullName).toBe("Noah Okafor");
    expect(exported.orders.length).toBeGreaterThan(0);

    await panel.getByRole("button", { name: "Anonymiser ce client" }).click();
    const confirm = panel.getByRole("button", {
      name: "Anonymiser définitivement",
    });
    await expect(confirm).toBeDisabled();
    await panel
      .getByLabel("Tapez ANONYMISER pour confirmer")
      .fill("anonymiser");
    await confirm.click();

    await expect(
      page.getByRole("heading", { level: 1, name: "Client anonymisé" }),
    ).toBeVisible();
    await expect(panel).toContainText("Client anonymisé le");
    await expect(page.getByText("Noah Okafor")).toHaveCount(0);
    await expect(page.getByLabel("Nouvelle note interne")).toHaveCount(0);
  });

  test("RGPD : le gestionnaire ne peut ni exporter ni anonymiser", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/clients/cli-0001");
    const panel = page.locator("#donnees-personnelles");
    await expect(panel).toContainText("traitée par un administrateur");
    await expect(
      panel.getByRole("link", { name: "Exporter les données" }),
    ).toHaveCount(0);
    await expect(
      panel.getByRole("button", { name: "Anonymiser ce client" }),
    ).toHaveCount(0);
    expect((await page.request.get("/clients/cli-0001/export")).status()).toBe(
      403,
    );
  });

  test("le filtre communautés et le tri gardent les communautés et leur remise", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/clients");
    const form = page.getByRole("form", { name: "Recherche de clients" });
    await form.getByLabel("Afficher").selectOption("communautes");
    await expect(page).toHaveURL(/type=communautes/);
    await form.getByLabel("Trier par").selectOption("commandes");

    await expect(page).toHaveURL(/type=communautes/);
    await expect(page).toHaveURL(/tri=commandes/);
    const community = page.getByRole("article", {
      name: "Communauté Crèche Les Lucioles",
    });
    await expect(community).toContainText("−10 % sur chaque commande");
    await expect(community).toContainText("Horaire choisi par chaque membre");
    await community.getByRole("link", { name: /Voir le détail/ }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Crèche Les Lucioles" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "Membres" }),
    ).toBeVisible();
  });
});
