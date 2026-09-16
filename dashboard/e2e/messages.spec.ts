import { expect, test } from "@playwright/test";
import { E2E_ACCOUNTS } from "../playwright.config";
import { login } from "./helpers";

/*
 * Boîte de réception : la liste (ordre, recherche, filtres), la fiche complète
 * avec la carte du client au-dessus, et les trois bascules.
 * Les tests partagent la base de test (un seul worker, dans l'ordre) : chaque
 * bascule est remise dans son état de départ.
 */
test.describe("messages", () => {
  test("la liste montre l'épinglé en tête, l'objet et les deux premières lignes", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/messages");

    const cards = page.getByRole("article");
    await expect(cards.first()).toHaveAccessibleName("Message de Amel Benali");
    await expect(cards.first()).toContainText("Épinglé");
    await expect(cards.first()).toContainText("Important");
    await expect(cards.first()).toContainText("Produit manquant ou abîmé");
    // Les deux premières lignes non vides, pas la troisième.
    await expect(cards.first()).toContainText(
      "Bonjour, La barquette de fraises",
    );
    await expect(cards.first()).not.toContainText("Merci d'avance");
    await expect(cards.first()).toContainText("2 pièces jointes");
    await expect(page.getByRole("status").first()).toContainText("non traité");
  });

  test("la recherche et les filtres restreignent la liste par l'URL", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/messages");
    const form = page.getByRole("form", {
      name: "Recherche et filtres des messages",
    });

    /*
     * « Réinitialiser » est un lien : la navigation vide l'URL, puis
     * AutoSubmitForm remonte ses champs avec les valeurs de cette nouvelle URL.
     * Il faut attendre que la recherche soit VIDÉE avant de toucher au filtre
     * suivant, sinon le formulaire repart avec l'ancienne saisie et les deux
     * critères se cumulent.
     */
    const search = form.getByLabel("Rechercher un message");
    const reset = async () => {
      await form.getByRole("link", { name: "Réinitialiser" }).click();
      await expect(search).toHaveValue("");
    };

    await search.fill("aubergines");
    await expect(page).toHaveURL(/q=aubergines/);
    await expect(page.getByRole("article")).toHaveCount(1);
    await expect(page.getByRole("article")).toHaveAccessibleName(
      "Message de Théo Marchand",
    );

    await reset();
    await form.getByLabel("Objet").selectOption("refund");
    await expect(page).toHaveURL(/objet=refund/);
    await expect(page.getByRole("article")).toHaveAccessibleName(
      "Message de Lucie Gauthier",
    );

    await reset();
    await form.getByLabel("Reçu du").fill("2026-09-08");
    await form.getByLabel("Reçu au").fill("2026-09-08");
    await expect(page).toHaveURL(/du=2026-09-08/);
    await expect(page).toHaveURL(/au=2026-09-08/);
    await expect(page.getByRole("article")).toHaveCount(2);

    await reset();
    await form.getByLabel("Seulement les messages signalés importants").check();
    await expect(page).toHaveURL(/important=oui/);
    await expect(page.getByRole("article")).toHaveCount(2);
  });

  test("la fiche affiche le client complet au-dessus du message entier", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/messages");
    // Amel a écrit deux fois : on ouvre le premier de la liste (l'épinglé).
    await page
      .getByRole("article", { name: "Message de Amel Benali" })
      .first()
      .getByRole("link", { name: /Lire le message/ })
      .click();

    await expect(
      page.getByRole("heading", { level: 1, name: "Message de Amel Benali" }),
    ).toBeVisible();

    // La fiche client, juste au-dessus : coordonnées et chiffres clés.
    const customer = page.getByRole("article", { name: "Client Amel Benali" });
    await expect(customer).toContainText("amel.benali@example.invalid");
    await expect(customer).toContainText("Commandes");
    await expect(customer).toContainText("Particulier");
    await expect(
      customer.getByRole("link", { name: /Voir le détail/ }),
    ).toBeVisible();

    // Puis le message complet, avec sa dernière ligne et ses pièces jointes.
    const message = page.getByRole("article", {
      name: "Message de Amel Benali",
    });
    await expect(message).toContainText("Merci d'avance");
    await expect(
      message.getByRole("heading", { name: /2 pièces jointes/ }),
    ).toBeVisible();
    await expect(
      message.getByRole("link", { name: /fraises-abimees\.jpg/ }),
    ).toBeVisible();
    await expect(
      message.getByRole("link", { name: "FIG-260907-001" }),
    ).toBeVisible();
  });

  test("le gestionnaire marque traité, épingle et signale, puis revient en arrière", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/messages/msg-0004");
    const message = page.getByRole("article", {
      name: "Message de Inès Rocher",
    });
    await expect(message).toContainText("Non traité");

    await message.getByRole("button", { name: "Marquer comme traité" }).click();
    await expect(message).toContainText("Traité");
    await expect(message).toContainText("traité le");

    await message.getByRole("button", { name: "Épingler" }).click();
    await expect(message).toContainText("Épinglé");

    await message.getByRole("button", { name: "Marquer important" }).click();
    await expect(message).toContainText("Important");

    // La liste le remonte en tête, épinglé le plus récemment.
    await page.goto("/messages");
    await expect(page.getByRole("article").first()).toHaveAccessibleName(
      "Message de Inès Rocher",
    );

    // On remet le message dans son état de départ pour les autres parcours.
    await page.goto("/messages/msg-0004");
    await message.getByRole("button", { name: "Désépingler" }).click();
    await expect(message).not.toContainText("Épinglé");
    await message
      .getByRole("button", { name: "Retirer « important »" })
      .click();
    await message
      .getByRole("button", { name: "Marquer comme non traité" })
      .click();
    await expect(message).toContainText("Non traité");
  });

  test("la section figure dans le menu des rôles qui y ont accès", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await expect(
      page.getByRole("navigation", { name: "Navigation principale" }),
    ).toContainText("Messages");
  });
});
