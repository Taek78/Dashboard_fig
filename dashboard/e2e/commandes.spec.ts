import { expect, test } from "@playwright/test";
import { E2E_ACCOUNTS } from "../playwright.config";
import { login } from "./helpers";

test.describe("commandes", () => {
  test("la liste mène au détail, et le changement de statut laisse une trace", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/commandes?statut=preparing");
    await page.getByRole("link", { name: "FIG-260907-001" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Commande FIG-260907-001" }),
    ).toBeVisible();

    await page.getByLabel("Nouveau statut").selectOption("delivering");
    await page.getByRole("button", { name: "Changer le statut" }).click();
    await expect(page.getByRole("status").first()).toContainText(
      "Statut mis à jour : Expédiée.",
    );

    const history = page.getByRole("region", { name: "Historique" });
    await expect(history).toContainText("Expédiée");
    await expect(history).toContainText("(depuis en préparation)");
    await expect(history).toContainText(E2E_ACCOUNTS.manager.name);

    // Amel a autorisé les notifications d'état : une est déposée pour l'application.
    const notifications = page.getByRole("region", {
      name: "Notifications au client",
    });
    await expect(notifications).toContainText(
      "Votre commande FIG-260907-001 est en route",
    );
    await expect(notifications).toContainText("en attente d'envoi");

    // Frais de livraison et adresse dans le détail ; le nom du client mène à sa fiche.
    await expect(page.getByText("Frais de livraison")).toBeVisible();
    await expect(page.getByText("12 rue des Lilas")).toBeVisible();
    await page.getByRole("link", { name: "Amel Benali" }).click();
    await expect(page).toHaveURL(/\/clients\/cli-0001$/);
  });

  test("un client qui n'a pas autorisé les notifications d'état n'en reçoit aucune", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    // cmd-0013 : Mathis, aucune autorisation.
    await page.goto("/commandes/cmd-0013");
    await expect(
      page.getByRole("region", { name: "Notifications au client" }),
    ).toContainText("n'a pas autorisé les notifications d'état");
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
    expect(values).toEqual(["delivering", "cancelled"]);
  });
});

test.describe("commandes : cartes, tournée et annulation", () => {
  test("la carte porte le créneau en grand, l'itinéraire, le nom cliquable et le geste suivant", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.admin);
    await page.goto("/commandes?du=2026-09-07&au=2026-09-07");
    await expect(page.getByRole("status").first()).toContainText(
      "livraison le lun. 7 sept. 2026",
    );
    const card = page.getByRole("article", {
      name: /^Commande FIG-260907-002,/,
    });
    await expect(card).toContainText("Créneau");
    await expect(card).toContainText("En préparation");
    await expect(
      card.getByRole("link", { name: /Itinéraire/ }),
    ).toHaveAttribute("href", /google\.com\/maps/);
    await expect(card.getByRole("link", { name: /^0[67] / })).toHaveAttribute(
      "href",
      /^tel:\+33/,
    );
    await expect(
      card.getByRole("link", { name: "Théo Marchand" }),
    ).toHaveAttribute("href", "/clients/cli-0002");

    await card.getByRole("button", { name: "Expédier la commande" }).click();
    await expect(card).toContainText("Expédiée");
    await expect(
      card.getByRole("button", { name: "Marquer comme livrée" }),
    ).toBeVisible();
  });

  test("les gommettes disent qui est présent dans la liste d'affectation", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/commandes?du=2026-09-08&au=2026-09-08");
    const card = page.getByRole("article", {
      name: /^Commande FIG-260907-005,/,
    });
    const select = card
      .getByRole("form", { name: "Affectation : Livreur" })
      .getByLabel("Livreur");
    await expect(
      select.locator("option", { hasText: "Malik Dembélé" }),
    ).toHaveText("🟢 Malik Dembélé");
    await expect(
      select.locator("option", { hasText: "Ousmane Diagne" }),
    ).toHaveText("🔴 Ousmane Diagne · en congé");
  });

  test("annuler depuis la carte exige un motif, affiché ensuite sur la carte", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    // Le jour du scénario : une fois annulée, la carte resterait absente d'une
    // liste filtrée sur « en préparation », et la liste complète est paginée.
    await page.goto("/commandes?date=2026-09-08");
    const card = page.getByRole("article", {
      name: /^Commande FIG-260907-006,/,
    });
    await expect(
      card.getByRole("button", { name: "Expédier la commande" }),
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

test.describe("commandes : recherche, dates et raccourcis", () => {
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

  test("une seule date suffit, des dates inversées affichent une erreur sans filtrer", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/commandes?du=2026-09-07");
    const form = page.getByRole("form", {
      name: "Recherche et filtres des commandes",
    });
    // Une seule date : ce jour-là, sans erreur.
    await expect(page.getByRole("status").first()).toContainText(
      "5 commandes · livraison le lun. 7 sept. 2026",
    );
    await expect(form.getByRole("alert")).toHaveCount(0);

    await page.goto("/commandes?du=2026-09-09&au=2026-09-05");
    await expect(form.getByRole("alert")).toContainText(
      "La date de début est après la date de fin",
    );
    await expect(form.getByLabel("Livraison du")).toHaveValue("2026-09-09");
    await expect(form.getByLabel("Livraison au")).toHaveValue("2026-09-05");
    // Rien n'est filtré : la liste complète, paginée.
    await expect(page.getByRole("status").first()).toContainText(/page 1 sur/);
  });

  test("le calendrier s'ouvre sur le mois de la date saisie, grise les jours voisins et écrit la date", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/commandes?du=2026-03-04");
    const form = page.getByRole("form", {
      name: "Recherche et filtres des commandes",
    });
    const openFrom = form.getByRole("button", {
      name: "Calendrier, date de début",
    });
    await openFrom.click();
    const picker = page.locator("[data-slot=date-picker]");
    await expect(picker.getByRole("heading")).toHaveText("mars 2026");
    // Mars 2026 commence un dimanche : la grille part du lundi 23 février, grisé.
    const days = picker.getByRole("grid").getByRole("button");
    await expect(days).toHaveCount(42);
    await expect(days.first()).toHaveAccessibleName("lundi 23 février 2026");
    await expect(days.first()).toHaveAttribute("data-outside", "");
    await expect(days.first()).toHaveClass(/text-muted-foreground/);
    // Le focus est sur la date saisie ; le clavier avance d'un jour.
    const selected = picker.getByRole("button", {
      name: "mercredi 4 mars 2026",
    });
    await expect(selected).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(
      picker.getByRole("button", { name: "jeudi 5 mars 2026" }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(picker).toHaveCount(0);

    // « Au » est vide : il s'ouvre sur le mois de « du » ; un clic écrit la date.
    await form.getByRole("button", { name: "Calendrier, date de fin" }).click();
    await expect(picker.getByRole("heading")).toHaveText("mars 2026");
    await picker.getByRole("button", { name: "lundi 9 mars 2026" }).click();
    await expect(form.getByLabel("Livraison au")).toHaveValue("2026-03-09");
    await expect(page).toHaveURL(/du=2026-03-04&au=2026-03-09/);

    // Sans date, chaque ouverture revient au mois actuel.
    await page.goto("/commandes");
    await openFrom.click();
    const now = new Intl.DateTimeFormat("fr-FR", {
      month: "long",
      year: "numeric",
      timeZone: "Europe/Paris",
    }).format(new Date());
    await expect(picker.getByRole("heading")).toHaveText(now);
    await picker.getByRole("button", { name: "Mois suivant" }).click();
    await page.keyboard.press("Escape");
    await openFrom.click();
    await expect(picker.getByRole("heading")).toHaveText(now);
  });

  test("sur téléphone, le sélecteur de date natif reste, sans bouton de calendrier", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 400, height: 860 });
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/commandes");
    const form = page.getByRole("form", {
      name: "Recherche et filtres des commandes",
    });
    await expect(
      form.getByRole("button", { name: "Calendrier, date de début" }),
    ).toBeHidden();
    await expect(form.getByLabel("Livraison du")).toHaveAttribute(
      "type",
      "date",
    );
  });

  test("une période sans commande le dit dans un bandeau bleu, sans perdre les autres filtres", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/commandes?du=2026-09-20&au=2026-09-21&statut=preparing");
    const notice = page.getByRole("status").filter({ hasText: "Aucune" });
    await expect(notice).toContainText(
      "Aucune commande livrée du dim. 20 sept. au lun. 21 sept. 2026 avec ces filtres.",
    );
    await expect(notice).toHaveClass(/text-info/);
    await notice.getByRole("link", { name: "Toutes les dates" }).click();
    await expect(page).toHaveURL(/\/commandes\?statut=preparing$/);
  });

  test("les raccourcis des 7 derniers jours gardent la recherche en cours", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/commandes?statut=delivered");
    const shortcuts = page.getByRole("navigation", {
      name: "7 derniers jours",
    });
    await expect(shortcuts.getByRole("link")).toHaveCount(8);
    const today = shortcuts.getByRole("link", { name: /^Aujourd'hui/ });
    await expect(today).toBeVisible();
    await today.click();
    await expect(page).toHaveURL(/statut=delivered/);
    await expect(page).toHaveURL(/du=\d{4}-\d{2}-\d{2}&au=\d{4}-\d{2}-\d{2}/);
    await expect(today).toHaveAttribute("aria-current", "date");
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

  test("l'ancienne adresse des livraisons redirige vers les commandes", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.admin);
    await page.goto("/livraisons?du=2026-09-07&au=2026-09-07");
    await expect(page).toHaveURL(/\/commandes\?du=2026-09-07&au=2026-09-07$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Commandes" }),
    ).toBeVisible();
  });
});
