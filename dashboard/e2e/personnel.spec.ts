import { expect, test } from "@playwright/test";
import { E2E_ACCOUNTS } from "../playwright.config";
import { login } from "./helpers";

test.describe("personnel", () => {
  test("ajouter un livreur, puis l'affecter à une commande depuis sa carte", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/personnel?type=livreur");
    await expect(
      page
        .getByRole("form", { name: "Recherche dans l'équipe" })
        .getByLabel("Métier"),
    ).toHaveValue("livreur");
    await page.getByRole("link", { name: "Nouvelle personne" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Nouvelle personne" }),
    ).toBeVisible();

    const stamp = Date.now();
    await page.getByLabel("Prénom").fill("Nour");
    await page.getByLabel("Nom", { exact: true }).fill(`Sassi ${stamp}`);
    await page.getByLabel("E-mail").fill(`nour.${stamp}@fig-demo.invalid`);
    await page.getByLabel("Téléphone").fill("06 39 98 90 50");
    await page.getByLabel("Date d'entrée").fill("2026-09-14");
    await page.getByLabel("Samedi").check();
    await page.getByRole("button", { name: "Ajouter à l'équipe" }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: `Nour Sassi ${stamp}` }),
    ).toBeVisible();
    await expect(page.getByRole("status").first()).toContainText(
      "Personne ajoutée à l'équipe.",
    );
    await expect(page.getByText("Aucune commande affectée")).toBeVisible();

    // Affectation depuis la carte de commande : le choix écrit aussitôt.
    // La personne est disponible : gommette verte devant son nom.
    await page.goto("/commandes?date=2026-09-08");
    const card = page.getByRole("article", {
      name: /^Commande FIG-260907-005,/,
    });
    const field = card.getByRole("form", { name: "Affectation : Livreur" });
    await field
      .getByLabel("Livreur")
      .selectOption({ label: `🟢 Nour Sassi ${stamp}` });
    await expect(field.getByRole("status")).toContainText(
      `Livreur : Nour Sassi ${stamp}.`,
    );

    // L'historique de la personne la retrouve.
    await page.goto("/personnel");
    await page
      .getByRole("link", { name: `Nour Sassi ${stamp}` })
      .first()
      .click();
    await expect(
      page.getByRole("heading", { level: 2, name: "Historique de traitement" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "FIG-260907-005" }),
    ).toBeVisible();
  });

  test("la recherche dans l'équipe trouve par nom ou téléphone et se filtre par disponibilité", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/personnel");
    const form = page.getByRole("form", { name: "Recherche dans l'équipe" });
    const search = form.getByLabel("Rechercher une personne");
    await search.pressSequentially("dembele", { delay: 50 });
    await expect(page).toHaveURL(/q=dembele/);
    await expect(
      page.getByRole("article", { name: "Personne Malik Dembélé" }),
    ).toBeVisible();
    await expect(page.getByRole("status").first()).toContainText(
      /^1 personne sur/,
    );
    await expect(search).toHaveValue("dembele");

    await page.goto("/personnel");
    await form.getByLabel("Disponibilité").selectOption("conge");
    await expect(page).toHaveURL(/dispo=conge/);
    await expect(
      page.getByRole("article", { name: "Personne Ousmane Diagne" }),
    ).toBeVisible();
    await form.getByLabel("Rechercher une personne").fill("90 04");
    await expect(page).toHaveURL(/q=90\+04/);
    await expect(page.getByText("Personne ne correspond")).toBeVisible();
  });

  test("24 h/24, arrêt maladie, puis départ confirmé par Oui / Non : date de sortie et section des partis", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/personnel/nouveau?type=preparateur");
    const stamp = Date.now();
    const name = `Inès Morel ${stamp}`;
    await page.getByLabel("Prénom").fill("Inès");
    await page.getByLabel("Nom", { exact: true }).fill(`Morel ${stamp}`);
    await page.getByLabel("E-mail").fill(`ines.${stamp}@fig-demo.invalid`);
    await page.getByLabel("Téléphone").fill("06 39 98 90 51");
    await page.getByLabel("Date d'entrée").fill("2026-01-05");
    await page
      .getByLabel("Créneau de travail")
      .selectOption({ label: "24 h/24 (sans horaire fixe)" });
    await page.getByLabel("Disponibilité").selectOption("arret_maladie");
    await page.getByRole("button", { name: "Ajouter à l'équipe" }).click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(page.getByText("Arrêt maladie").first()).toBeVisible();

    // Pas de date de sortie tant que la case n'est pas cochée.
    const departed = page.getByLabel("Parti de l'entreprise");
    const leftAt = page.getByLabel("Date de sortie");
    await expect(departed).not.toBeChecked();
    await expect(leftAt).toHaveCount(0);

    // Cocher demande confirmation : « Non » laisse la case décochée.
    await departed.click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText(
      `Voulez-vous vraiment indiquer que ${name} a quitté l'entreprise ?`,
    );
    await expect(dialog.getByRole("button", { name: "Non" })).toBeFocused();
    await dialog.getByRole("button", { name: "Non" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(departed).not.toBeChecked();
    await expect(leftAt).toHaveCount(0);

    // « Oui » coche la case et fait apparaître la date, qui prend le focus.
    await departed.click();
    await dialog.getByRole("button", { name: "Oui" }).click();
    await expect(departed).toBeChecked();
    await expect(leftAt).toBeFocused();

    // Décocher cache la date sans question ; recocher redemande.
    await departed.click();
    await expect(dialog).toHaveCount(0);
    await expect(leftAt).toHaveCount(0);
    await departed.click();
    await dialog.getByRole("button", { name: "Oui" }).click();

    // Une date avant l'entrée est refusée par le serveur.
    await leftAt.fill("2025-12-31");
    const save = page.getByRole("button", {
      name: "Enregistrer les modifications",
    });
    await save.click();
    await expect(
      page.getByText("La date de sortie ne précède pas la date d'entrée."),
    ).toBeVisible();
    await leftAt.fill("2026-09-15");
    await save.click();
    await expect(
      page.getByRole("status").filter({ hasText: "enregistrée" }),
    ).toContainText(`Fiche de ${name} enregistrée.`);

    // La liste sépare les présents des partis.
    await page.goto(`/personnel?q=${stamp}`);
    const gone = page.getByRole("region", { name: "Partis de l'entreprise" });
    await expect(
      gone.getByRole("article", { name: `Personne ${name}` }),
    ).toContainText("Parti·e le mar. 15 sept. 2026");
    await expect(
      page.getByRole("region", { name: "Dans l'entreprise" }),
    ).toHaveCount(0);
    await page.goto("/personnel");
    await expect(
      page
        .getByRole("region", { name: "Dans l'entreprise" })
        .getByRole("article", { name: "Personne Malik Dembélé" }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "Partis de l'entreprise" })
        .getByRole("article", { name: "Personne Paul Girard" }),
    ).toBeVisible();
  });

  test("le filtre des gestionnaires renvoie vers les comptes", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/personnel?type=gestionnaire");
    await expect(page.getByText("Accès au back-office")).toBeVisible();
    await expect(page.getByRole("link", { name: "Comptes" })).toBeVisible();
  });

  test("depuis la carte : dupliquer préremplit la fiche, et l'historique se filtre", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/personnel?type=livreur");
    const card = page.getByRole("article", { name: "Personne Malik Dembélé" });
    await expect(card.getByRole("link", { name: "Modifier" })).toBeVisible();
    await expect(
      card.getByRole("button", { name: "Supprimer Malik Dembélé" }),
    ).toBeVisible();
    await card.getByRole("link", { name: "Dupliquer" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Nouvelle personne" }),
    ).toBeVisible();
    await expect(
      page.getByText("Duplication de la fiche de Malik Dembélé"),
    ).toBeVisible();
    await expect(page.getByLabel("Métier")).toHaveValue("livreur");
    await expect(page.getByLabel("E-mail")).toHaveValue("");

    // La copie d'une personne partie arrive dans l'entreprise, sans date de sortie.
    await page.goto("/personnel/nouveau?depuis=stf-0010");
    await expect(
      page.getByText("Duplication de la fiche de Paul Girard"),
    ).toBeVisible();
    await expect(page.getByLabel("Parti de l'entreprise")).not.toBeChecked();
    await expect(page.getByLabel("Date de sortie")).toHaveCount(0);

    await page.goto("/personnel/stf-0001");
    await expect(
      page.getByRole("heading", { level: 2, name: "Modifier la fiche" }),
    ).toBeVisible();
    const search = page.getByRole("form", {
      name: "Recherche dans l'historique",
    });
    await search.getByLabel("Rechercher une commande").fill("FIG-260906");
    await search.getByLabel("Rôle").selectOption("livraison");
    await expect(page).toHaveURL(/role=livraison/);
    await expect(page).toHaveURL(/q=FIG-260906/);
    await expect(
      page.getByRole("status").filter({ hasText: "correspond" }),
    ).toContainText("2 commandes sur");
  });
});
