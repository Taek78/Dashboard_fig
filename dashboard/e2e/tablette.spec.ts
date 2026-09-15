import { expect, test, type Page } from "@playwright/test";
import { E2E_ACCOUNTS } from "../playwright.config";
import { login } from "./helpers";

/** Défilement horizontal de la page (0 attendu). */
const overflow = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );

test.describe("tablette (768 px)", () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test("menu ouvert puis replié : les cartes suivent la place disponible, sans défilement horizontal", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/commandes?du=2026-09-05&au=2026-09-09");
    const card = page.getByRole("article", {
      name: /^Commande FIG-260907-005,/,
    });
    await expect(card).toBeVisible();
    expect(await overflow(page)).toBe(0);

    // Menu ouvert : zone de contenu étroite, les bandes de la carte s'empilent.
    const team = card.getByRole("form", { name: "Affectation : Livreur" });
    const client = card.getByText("Détail de la commande");
    const stacked = async () =>
      (await team.boundingBox())!.y > (await client.boundingBox())!.y;
    expect(await stacked()).toBe(true);

    // Menu replié : plus de place, client et suivi côte à côte.
    await page.getByRole("button", { name: "Replier le menu" }).click();
    await expect(async () => expect(await stacked()).toBe(false)).toPass();
    expect(await overflow(page)).toBe(0);
  });

  test("personnel et métriques restent sans défilement horizontal", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    for (const path of ["/", "/personnel", "/metriques?periode=ce-mois"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await overflow(page)).toBe(0);
    }
  });
});

test.describe("menu replié en icônes", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("chaque lien est cliquable en son centre", async ({ page }) => {
    await login(page, E2E_ACCOUNTS.admin);
    await page.getByRole("button", { name: "Replier le menu" }).click();
    const nav = page.getByRole("navigation", { name: "Navigation principale" });
    const links = nav.getByRole("link");
    await expect(links.first()).toBeVisible();
    await page.waitForTimeout(300); // fin de l'animation de largeur
    const blocked = await links.evaluateAll((elements) =>
      elements
        .filter((link) => {
          const box = link.getBoundingClientRect();
          const hit = document.elementFromPoint(
            box.left + box.width / 2,
            box.top + box.height / 2,
          );
          return !hit || !link.contains(hit);
        })
        .map((link) => link.textContent),
    );
    expect(blocked).toEqual([]);
    await nav.getByRole("link", { name: "Personnel" }).click();
    await expect(page).toHaveURL(/\/personnel$/);
  });
});

test("un clic sur le graphe ne déclenche pas l'avertissement aria-hidden", async ({
  page,
}) => {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("aria-hidden")) warnings.push(message.text());
  });
  await login(page, E2E_ACCOUNTS.admin);
  await page.goto("/metriques?periode=ce-mois");
  const chart = page.locator(".recharts-surface").first();
  await chart.scrollIntoViewIfNeeded();
  await chart.click();
  await expect(page.locator(".recharts-surface:focus")).toHaveCount(0);
  expect(warnings).toEqual([]);
});
