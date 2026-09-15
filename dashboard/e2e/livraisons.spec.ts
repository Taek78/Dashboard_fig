import { expect, test } from "@playwright/test";
import { E2E_ACCOUNTS } from "../playwright.config";
import { login } from "./helpers";

test.describe("tournée", () => {
  test("le geste suivant fait avancer une livraison en un bouton", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.admin);
    await page.goto("/livraisons?date=2026-09-07");
    await expect(
      page.getByRole("progressbar", { name: "Avancement de la tournée" }),
    ).toBeVisible();

    const card = page.getByRole("article", { name: /FIG-260907-002$/ });
    await expect(card).toContainText("En préparation");
    await expect(
      card.getByRole("link", { name: /Itinéraire/ }),
    ).toHaveAttribute("href", /google\.com\/maps/);
    await card.getByRole("button", { name: "Expédier la commande" }).click();
    await expect(card).toContainText("Expédiée");
    await expect(
      card.getByRole("button", { name: "Marquer comme livrée" }),
    ).toBeVisible();
  });

  test("la première livraison non terminée est signalée comme prochaine", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.admin);
    await page.goto("/livraisons?date=2026-09-07");
    const first = page.getByRole("article", { name: /^Livraison 1,/ });
    await expect(first).toContainText("Prochaine");
  });
});

test.describe("tournée : période, recherche et avancement", () => {
  test("une période de trois jours est groupée par jour, avec l'avancement détaillé", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.admin);
    await page.goto("/livraisons?du=2026-09-06&au=2026-09-08");
    for (const heading of [
      /^dimanche 6 septembre/,
      /^lundi 7 septembre/,
      /^mardi 8 septembre/,
    ]) {
      await expect(
        page.getByRole("heading", { level: 2, name: heading }),
      ).toBeVisible();
    }
    const legend = page.getByRole("list", { name: "Détail par statut" });
    await expect(legend).toContainText("Livrées");
    await expect(legend).toContainText("En préparation");
    await expect(legend).not.toContainText("En attente");
    await expect(
      page.getByRole("progressbar", {
        name: "Avancement du dimanche 6 septembre",
      }),
    ).toHaveAttribute("aria-valuenow", "4");
  });

  test("la recherche et le filtre livreur s'appliquent à la tournée", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.admin);
    await page.goto("/livraisons?du=2026-09-06&au=2026-09-08");
    const form = page.getByRole("form", {
      name: "Recherche et filtres des livraisons",
    });
    await form.getByLabel("Livreur").selectOption({ label: "Malik Dembélé" });

    await expect(page).toHaveURL(/livreur=stf-0001/);
    await expect(page.getByRole("status").first()).toContainText(
      "4 livraisons",
    );
    await form.getByLabel("Rechercher une livraison").fill("gauthier");
    await expect(page).toHaveURL(/q=gauthier/);
    await expect(page).toHaveURL(/livreur=stf-0001/);
    await expect(page.getByRole("status").first()).toContainText("1 livraison");
    await expect(
      page.getByRole("article", { name: /FIG-260906-004$/ }),
    ).toBeVisible();
  });

  test("la période est limitée à 7 jours et les raccourcis couvrent les 7 derniers jours", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.admin);
    await page.goto("/livraisons?du=2026-09-01&au=2026-09-30");
    await expect(page.getByText("Période ramenée à 7 jours")).toBeVisible();
    await expect(page.getByLabel("Livraison au")).toHaveValue("2026-09-07");
    const shortcuts = page.getByRole("navigation", {
      name: "7 derniers jours",
    });
    await expect(shortcuts.getByRole("link")).toHaveCount(8);
  });
});
