import { expect, test } from "@playwright/test";
import { E2E_ACCOUNTS } from "../playwright.config";
import { login, openFilters } from "./helpers";

test.describe("commandes", () => {
  test("filtres repliés par défaut ; le bouton « Filtres » les déroule et les replie", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/commandes");
    const toggle = page.getByRole("button", { name: "Filtres" });
    const status = page.getByLabel("Statut", { exact: true });
    // Replié par défaut : il faut cliquer pour dérouler.
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(status).toBeHidden();
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(status).toBeVisible();
    await toggle.click();
    await expect(status).toBeHidden();
  });

  test("la liste mène au détail, et le changement de statut laisse une trace", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/commandes?statut=preparing");
    await openFilters(page);
    await page.getByRole("link", { name: "FIG-260907-001" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Commande FIG-260907-001" }),
    ).toBeVisible();

    // Choisir un statut l'écrit aussitôt.
    await page.getByLabel("Statut de la commande").selectOption("delivering");
    const confirmation = page
      .getByRole("status")
      .filter({ hasText: "Statut mis à jour" });
    await expect(confirmation).toContainText("Statut mis à jour : Expédiée.");
    await expect(confirmation).toContainText("Client notifié");
    await expect(page.getByLabel("Statut de la commande")).toHaveValue(
      "delivering",
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

    // Case « Notifier le client » décochée : le changement passe, rien n'est déposé.
    const notify = page.getByLabel("Notifier le client");
    await expect(notify).toBeChecked();
    await notify.uncheck();
    await page.getByLabel("Statut de la commande").selectOption("delivered");
    await expect(confirmation).toContainText("Statut mis à jour : Livrée.");
    await expect(confirmation).toContainText("Client non notifié");
    await expect(notifications).not.toContainText("a été livrée");

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
    await openFilters(page);
    await expect(
      page.getByRole("region", { name: "Notifications au client" }),
    ).toContainText("n'a pas autorisé les notifications d'état");
    // La case est désactivée et le dit.
    const notify = page.getByLabel(
      "Notifications non autorisées par le client",
    );
    await expect(notify).toBeDisabled();
    await expect(notify).not.toBeChecked();
    await expect(page.getByLabel("Notifier le client")).toHaveCount(0);
  });

  test("tous les statuts sont proposés : livrée directement, puis retour en préparation", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/commandes/cmd-0009");
    await openFilters(page);
    const select = page.getByLabel("Statut de la commande");
    const values = await select
      .locator("option")
      .evaluateAll((options) =>
        options.map((o) => (o as HTMLOptionElement).value),
      );
    expect(values).toEqual([
      "preparing",
      "delivering",
      "delivered",
      "cancelled",
    ]);
    await expect(select).toHaveValue("preparing");

    await select.selectOption("delivered");
    const status = page
      .getByRole("status")
      .filter({ hasText: "Statut mis à jour" });
    await expect(status).toContainText("Statut mis à jour : Livrée.");
    await expect(status).toContainText("Client notifié");
    await expect(select).toHaveValue("delivered");
    // Livrée une fois : la case « Notifier le client » se décoche d'elle-même (Élise a autorisé).
    const notify = page.getByLabel("Notifier le client");
    await expect(notify).toBeEnabled();
    await expect(notify).not.toBeChecked();

    await select.selectOption("preparing");
    await expect(status).toContainText("Statut mis à jour : En préparation.");
    await expect(status).toContainText("Client non notifié");
    const history = page.getByRole("region", { name: "Historique" });
    await expect(history).toContainText("En préparation (depuis livrée)");
    await expect(history).toContainText("Livrée (depuis en préparation)");
  });
});

test.describe("commandes : cartes, tournée et annulation", () => {
  test("la carte porte le créneau en grand, l'itinéraire, le nom cliquable et la liste du statut", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.admin);
    await page.goto("/commandes?du=2026-09-07&au=2026-09-07");
    await openFilters(page);
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

    const select = card.getByLabel("Statut de la commande");
    await expect(select).toHaveValue("preparing");
    await select.selectOption("delivering");
    await expect(card).toContainText("Expédiée");
    await expect(select).toHaveValue("delivering");
    await expect(
      card.getByRole("status").filter({ hasText: "Statut mis à jour" }),
    ).toContainText("Client notifié");
    // Cochée par défaut tant que la commande n'a jamais été livrée ; décochée dès qu'elle l'est.
    const notify = card.getByLabel("Notifier le client");
    await expect(notify).toBeChecked();
    await select.selectOption("delivered");
    await expect(card).toContainText("Livrée");
    await expect(select).toHaveValue("delivered");
    await expect(notify).not.toBeChecked();
  });

  test("affecter garde le NOM choisi dans la liste ; une personne indisponible fait apparaître l'avertissement", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/commandes?du=2026-09-08&au=2026-09-08");
    const card = page.getByRole("article", {
      name: /^Commande FIG-260907-005,/,
    });
    const field = card.getByRole("form", { name: "Affectation : Livreur" });
    const select = field.getByLabel("Livreur");
    const before = await select.inputValue();
    const warning = field.locator('[data-slot="unavailable-warning"]');

    await select.selectOption({ label: "🔴 Ousmane Diagne · en congé" });
    await expect(field.getByRole("status")).toContainText(
      "Livreur : Ousmane Diagne.",
    );
    // Plus de retour sur l'option vide après l'écriture.
    await expect(select.locator("option:checked")).toHaveText(
      "🔴 Ousmane Diagne · en congé",
    );
    await expect(warning).toBeVisible();
    await expect(warning).toContainText("Ousmane Diagne est indisponible");

    await select.selectOption({ label: "🟢 Malik Dembélé" });
    await expect(select.locator("option:checked")).toHaveText(
      "🟢 Malik Dembélé",
    );
    await expect(warning).toHaveCount(0);

    // Remise dans l'état du scénario.
    await select.selectOption(before);
    await expect(select).toHaveValue(before);
  });

  test("les gommettes disent qui est présent dans la liste d'affectation", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/commandes?du=2026-09-08&au=2026-09-08");
    await openFilters(page);
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
    await openFilters(page);
    const card = page.getByRole("article", {
      name: /^Commande FIG-260907-006,/,
    });
    const select = card.getByLabel("Statut de la commande");
    await expect(select).toHaveValue("preparing");
    await select.selectOption("cancelled");
    const panel = card.getByRole("group", {
      name: "Annulation de la commande",
    });
    await panel.getByLabel("Motif communiqué au client").selectOption("other");
    await panel.getByLabel("Précision").fill("Client absent, injoignable");
    await expect(panel).toContainText("26 / 100 caractères");
    await panel.getByRole("button", { name: "Confirmer l'annulation" }).click();
    await expect(card).toContainText("Annulée");
    await expect(select).toHaveValue("cancelled");
    // Yanis n'a pas autorisé les notifications : le motif est enregistré, pas communiqué.
    await expect(
      card.getByRole("status").filter({ hasText: "Commande annulée" }),
    ).toContainText("Motif enregistré");
    await expect(
      card.getByRole("status").filter({ hasText: "Commande annulée" }),
    ).toContainText("Client non notifié");
    await expect(card).toContainText("Autre : Client absent, injoignable");

    await page.goto("/commandes/cmd-0010");
    await openFilters(page);
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
    await openFilters(page);
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
    await openFilters(page);
    const form = page.getByRole("form", {
      name: "Recherche et filtres des commandes",
    });
    // Une seule date : ce jour-là, sans erreur.
    await expect(page.getByRole("status").first()).toContainText(
      "5 commandes · livraison le lun. 7 sept. 2026",
    );
    await expect(form.getByRole("alert")).toHaveCount(0);

    await page.goto("/commandes?du=2026-09-09&au=2026-09-05");
    await openFilters(page);
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
    await openFilters(page);
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
    await openFilters(page);
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
    await openFilters(page);
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
    await openFilters(page);
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
    await openFilters(page);
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

  test("l'avancement résume toutes les commandes listées ; « Aujourd'hui » ouvre la ligne des raccourcis", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/commandes?du=2026-09-07&au=2026-09-07");
    await openFilters(page);
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: /Avancement · tournée du lundi 7 septembre 2026/,
      }),
    ).toBeVisible();
    const bar = page.getByRole("progressbar", {
      name: "Avancement des commandes listées",
    });
    await expect(bar).toHaveAttribute("aria-valuemax", "5");
    const shortcuts = page.getByRole("navigation", {
      name: "7 derniers jours",
    });
    const first = shortcuts.getByRole("link").first();
    await expect(first).toHaveText(/^Aujourd'hui/);
    await expect(first).toHaveAttribute("data-today", "true");

    // Toutes pages : la barre compte au-delà des 40 commandes de la page.
    await page.goto("/commandes?statut=delivered");
    await openFilters(page);
    const total = Number(
      await page
        .getByRole("progressbar", { name: "Avancement des commandes listées" })
        .getAttribute("aria-valuemax"),
    );
    expect(total).toBeGreaterThan(40);
  });

  test("commandes de communauté : la communauté puis l'interlocuteur, et le filtre par type", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/commandes?type=communaute");
    await openFilters(page);
    const cards = page.getByRole("article", { name: /^Commande FIG-/ });
    await expect(cards.first()).toBeVisible();
    for (const card of await cards.all()) {
      await expect(card).toContainText("Communauté");
      await expect(card).toContainText("Interlocuteur :");
      await expect(card).not.toContainText("Particulier");
    }
    const form = page.getByRole("form", {
      name: "Recherche et filtres des commandes",
    });
    const kinds = form.getByRole("radiogroup", { name: "Type de commande" });
    await expect(
      kinds.getByRole("radio", { name: "Communautés" }),
    ).toBeChecked();
    await kinds.getByRole("radio", { name: "Particuliers" }).check();
    await expect(page).toHaveURL(/type=particulier/);
    await expect(page.getByRole("article").first()).toContainText(
      "Particulier",
    );
    await expect(page.getByRole("article").first()).not.toContainText(
      "Interlocuteur :",
    );
  });

  test("le filtre préparateur garde ses commandes, « Réinitialiser » rend la liste complète", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/commandes?du=2026-09-05&au=2026-09-09");
    await openFilters(page);
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
    await openFilters(page);
    await expect(page).toHaveURL(/\/commandes\?du=2026-09-07&au=2026-09-07$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Commandes" }),
    ).toBeVisible();
  });
});
