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
