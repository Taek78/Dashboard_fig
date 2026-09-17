import { expect, test, type Page } from "@playwright/test";
import { E2E_ACCOUNTS } from "../playwright.config";
import { login } from "./helpers";

/*
 * Tableau de bord : l'alerte quand plus aucun préparateur n'est présent, le
 * raccourci vers les livraisons du jour, la période personnalisée. Les tests
 * partagent
 * la base (un seul worker, dans l'ordre) : les disponibilités modifiées sont
 * remises comme avant.
 */
async function setAvailability(page: Page, staffId: string, value: string) {
  await page.goto(`/personnel/${staffId}`);
  await page.getByLabel("Disponibilité").selectOption(value);
  await page
    .getByRole("button", { name: "Enregistrer les modifications" })
    .click();
  await expect(page.getByRole("status").first()).toContainText(/enregistr/i);
}

test.describe("tableau de bord", () => {
  test("aucun préparateur présent : l'alerte passe en tête, puis disparaît quand quelqu'un revient", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.admin);
    await page.goto("/");
    // Dans le contenu seulement : Next annonce les navigations dans un
    // role="alert" vide en fin de page.
    const alerts = page.getByRole("main").getByRole("alert");
    await expect(alerts).toHaveCount(0);

    // Julien et Fatou sont les deux préparateurs présents ; Rémi est déjà indisponible.
    await setAvailability(page, "stf-0005", "conge");
    await setAvailability(page, "stf-0006", "indisponible");
    await page.goto("/");
    const alert = alerts;
    await expect(alert).toContainText("Aucun préparateur disponible");
    await expect(alert).toContainText(
      "aucune préparation de commande n'est possible",
    );
    await expect(alert).not.toContainText("Aucun livreur disponible");
    // En tête : avant le choix de la période.
    const period = page.getByRole("form", { name: "Choix de la période" });
    expect((await alert.boundingBox())!.y).toBeLessThan(
      (await period.boundingBox())!.y,
    );
    await expect(
      alert.getByRole("link", { name: "Voir les préparateurs" }),
    ).toHaveAttribute("href", "/personnel?type=preparateur&presence=actifs");

    await setAvailability(page, "stf-0005", "disponible");
    await setAvailability(page, "stf-0006", "disponible");
    await page.goto("/");
    await expect(alerts).toHaveCount(0);
  });

  test("« Livraisons du jour » ouvre les commandes du jour, et une plage libre vide est dite en bleu", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.admin);
    await page.goto("/");
    await page.getByRole("link", { name: "Livraisons du jour" }).click();
    await expect(page).toHaveURL(/\/commandes\?du=\d{4}-\d{2}-\d{2}&au=/);

    await page.goto("/?du=2030-01-01&au=2030-01-31");
    const notice = page.getByRole("status").filter({ hasText: "Aucune" });
    await expect(notice).toContainText("Aucune commande livrée du");
    await expect(notice).toHaveClass(/text-info/);
    await notice.getByRole("link", { name: "Revenir à aujourd'hui" }).click();
    await expect(page).toHaveURL(/\/\?tva=ht$/);
  });

  test("sans commande aujourd'hui, l'état vide « Aucune commande » remplace la barre", async ({
    page,
  }) => {
    // Les données de démonstration s'arrêtent le 14 septembre 2026 (HISTORY_TO).
    await login(page, E2E_ACCOUNTS.admin);
    await page.goto("/");
    await expect(
      page.getByText("Aucune commande", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(/Aujourd'hui : rien à préparer ni à livrer/),
    ).toBeVisible();
    await expect(page.getByRole("progressbar")).toHaveCount(0);
  });

  test("des dates inversées dans l'URL ouvrent la zone, affichent l'erreur et gardent la période prédéfinie", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.admin);
    await page.goto("/?periode=hier&du=2026-09-09&au=2026-09-05");
    const form = page.getByRole("form", { name: "Choix de la période" });
    await expect(form.getByRole("alert")).toContainText(
      "La date de début est après la date de fin",
    );
    await expect(form.getByLabel("Du")).toHaveValue("2026-09-09");
    await expect(form.getByLabel("Période", { exact: true })).toHaveValue(
      "personnalisee",
    );
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("header")).not.toContainText("Du mer.");
    await expect(page.getByText(/^Hier ·/)).toBeVisible();
  });

  test("la zone de dates n'existe qu'avec « Période personnalisée » ; le choix survit au passage HT / TTC et se referme avec une période prédéfinie", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.admin);
    await page.goto("/");
    const form = page.getByRole("form", { name: "Choix de la période" });
    const period = form.getByLabel("Période", { exact: true });
    await expect(period).toHaveValue("aujourdhui");
    await expect(form.getByLabel("Du")).toHaveCount(0);

    // Le choix ouvre la zone sans envoi ; l'envoi met la plage dans l'URL.
    await period.selectOption("personnalisee");
    await form.getByLabel("Du").fill("2026-09-05");
    await form.getByLabel("Au").fill("2026-09-09");
    await form.getByRole("button", { name: "Afficher" }).click();
    await expect(page).toHaveURL(
      /\/\?tva=ht&periode=personnalisee&du=2026-09-05&au=2026-09-09$/,
    );
    await expect(period).toHaveValue("personnalisee");
    await expect(form.getByLabel("Du")).toHaveValue("2026-09-05");
    await expect(form).toContainText(
      /Période affichée : du .*5 sept\. au .*9 sept\. 2026\./,
    );

    // HT / TTC rejoue la période personnalisée.
    await page
      .getByRole("group", { name: "Mode de TVA" })
      .getByRole("link", { name: "TTC" })
      .click();
    await expect(page).toHaveURL(
      /\/\?periode=personnalisee&du=2026-09-05&au=2026-09-09&tva=ttc$/,
    );
    await expect(form.getByLabel("Au")).toHaveValue("2026-09-09");

    // Une période prédéfinie referme la zone : les dates ne partent pas dans l'URL.
    await period.selectOption("hier");
    await expect(form.getByLabel("Du")).toHaveCount(0);
    await form.getByRole("button", { name: "Afficher" }).click();
    await expect(page).toHaveURL(/\/\?tva=ttc&periode=hier$/);
    await expect(form.getByLabel("Du")).toHaveCount(0);
    await expect(page.getByText(/^Hier ·/)).toBeVisible();
  });
});
