import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { E2E_ACCOUNTS } from "../playwright.config";
import { login, openFilters } from "./helpers";

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
    await openFilters(page);

    // Deux groupes séparés : les épinglés, puis les autres.
    const pinned = page.getByRole("region", { name: "Épinglés" });
    const others = page.getByRole("region", { name: "Autres messages" });
    await expect(pinned.getByRole("article")).toHaveCount(1);
    await expect(others.getByRole("article")).toHaveCount(6);

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
    // Les pièces jointes en pastille violette, avant le texte.
    const attachments = cards.first().getByText("2 pièces jointes");
    await expect(attachments).toHaveClass(/text-attachment/);
    // La commande jointe (livraison et équipe) est AU-DESSUS du texte.
    const order = cards.first().getByText("FIG-260907-001");
    const preview = cards.first().getByText(/La barquette de fraises/);
    expect((await order.boundingBox())!.y).toBeLessThan(
      (await preview.boundingBox())!.y,
    );
    await expect(cards.first()).toContainText("Préparateur : non affecté");
    // Le nom mène à la fiche du client, « Lire le message » au message.
    await expect(
      cards.first().getByRole("link", { name: "Amel Benali", exact: true }),
    ).toHaveAttribute("href", "/clients/cli-0001");
    await expect(page.getByRole("status").first()).toContainText("non traité");
  });

  test("une période de réception sans message le dit dans un bandeau bleu", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/messages?du=2026-08-01&au=2026-08-31");
    await openFilters(page);
    const notice = page.getByRole("status").filter({ hasText: "Aucun" });
    await expect(notice).toContainText(
      "Aucun message reçu du sam. 1 août au lun. 31 août 2026.",
    );
    await expect(notice).toHaveClass(/text-info/);
  });

  test("la recherche et les filtres restreignent la liste par l'URL", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/messages");
    await openFilters(page);
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
      // L'URL nue signale que la navigation est passée ET que les champs ont
      // été remontés : la recherche seule ne suffirait pas quand elle était
      // déjà vide (le filtre suivant serait tapé avant le remontage).
      await expect(page).toHaveURL(/\/messages$/);
      await expect(search).toHaveValue("");
      await expect(form.getByLabel("Objet")).toHaveValue("");
      await expect(form.getByLabel("Reçu du")).toHaveValue("");
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
    await form.getByLabel("Importants seulement").check();
    await expect(page).toHaveURL(/important=oui/);
    await expect(page.getByRole("article")).toHaveCount(2);
  });

  test("la fiche affiche le client complet au-dessus du message entier", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/messages");
    await openFilters(page);
    // Amel a écrit deux fois : on ouvre le premier de la liste (l'épinglé).
    await page
      .getByRole("article", { name: "Message de Amel Benali" })
      .first()
      .getByRole("link", { name: /Lire le message/ })
      .click();

    await expect(
      page.getByRole("heading", { level: 1, name: "Message de Amel Benali" }),
    ).toBeVisible();

    // La fiche client, juste au-dessus : coordonnées, adresse et chiffres clés.
    const customer = page.getByRole("article", { name: "Client Amel Benali" });
    await expect(customer).toContainText("amel.benali@example.invalid");
    await expect(customer).toContainText("12 rue des Lilas");
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
    // La tuile (son nom commence par celui du fichier), pas son icône « Télécharger … ».
    const photo = message.getByRole("link", { name: /^fraises-abimees\.png/ });
    await expect(photo).toBeVisible();
    // L'image hébergée est VRAIMENT chargée (route du back-office, session du
    // gestionnaire), pas un cadre vide.
    await expect
      .poll(() =>
        photo
          .locator("img")
          .evaluate(
            (img: HTMLImageElement) => img.complete && img.naturalWidth,
          ),
      )
      .toBe(64);
    const href = await photo.getAttribute("href");
    expect(href).toMatch(/^\/messages\/fichiers\/upl-0001$/);
    const file = await page.request.get(href!);
    expect(file.status()).toBe(200);
    expect(file.headers()["content-type"]).toBe("image/png");
    expect(file.headers()["x-content-type-options"]).toBe("nosniff");
    expect(file.headers()["content-security-policy"]).toContain("sandbox");
    // La commande jointe, en détail : dates, adresse, préparateur et livreur.
    const order = message.getByRole("region", {
      name: /Commande jointe/,
    });
    await expect(
      order.getByRole("link", { name: "FIG-260907-001" }),
    ).toBeVisible();
    await expect(order).toContainText("Commandée le");
    await expect(order).toContainText("10:00–11:00");
    await expect(order).toContainText("12 rue des Lilas, 75011 Paris");
    await expect(order).toContainText("Préparateur");
    await expect(order).toContainText("Livreur");
    await expect(order).toContainText("Non affecté");
  });

  test("un message important porte un dégradé rouge, un message ordinaire non", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/messages");
    await openFilters(page);
    const important = page
      .getByRole("article", { name: "Message de Amel Benali" })
      .first();
    await expect(important).toHaveClass(/from-destructive/);
    const plain = page.getByRole("article", { name: "Message de Inès Rocher" });
    await expect(plain).not.toHaveClass(/from-destructive/);
  });

  test("le gestionnaire marque traité, épingle et signale, puis revient en arrière", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/messages/msg-0004");
    await openFilters(page);
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

    // La liste le remonte en tête du groupe des épinglés, le plus récent d'abord.
    await page.goto("/messages");
    await openFilters(page);
    const pinned = page.getByRole("region", { name: "Épinglés" });
    await expect(pinned.getByRole("article")).toHaveCount(2);
    await expect(pinned.getByRole("article").first()).toHaveAccessibleName(
      "Message de Inès Rocher",
    );

    // On remet le message dans son état de départ pour les autres parcours.
    await page.goto("/messages/msg-0004");
    await openFilters(page);
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

  test("la pastille des pièces jointes ouvre un menu qui télécharge l'archive", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/messages");
    await openFilters(page);
    const card = page
      .getByRole("article", { name: "Message de Amel Benali" })
      .first();
    const trigger = card.getByRole("button", {
      name: "2 pièces jointes : télécharger",
    });
    await trigger.click();
    const menu = page.getByRole("menu");
    // Une seule option depuis le 2026-09-18 : « Visualiser » a été retirée.
    await expect(menu.getByRole("menuitem")).toHaveText([
      "Télécharger les pièces jointes",
    ]);

    // L'archive ZIP : nommée d'après le client et le jour, et c'est un vrai ZIP.
    const archive = page.waitForEvent("download");
    await menu
      .getByRole("menuitem", { name: "Télécharger les pièces jointes" })
      .click();
    const zip = await archive;
    expect(zip.suggestedFilename()).toBe(
      "pieces-jointes-amel-benali-2026-09-08.zip",
    );
    const bytes = await readFile((await zip.path())!);
    expect([...bytes.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(bytes.includes(Buffer.from("fraises-abimees.png"))).toBe(true);

    // Échap referme le menu et rend le focus à la pastille.
    await trigger.click();
    await expect(page.getByRole("menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toBeHidden();
    await expect(trigger).toBeFocused();

    // La page « Visualiser » n'existe plus.
    const gone = await page.request.get("/messages/msg-0001/pieces-jointes");
    expect(gone.status()).toBe(404);
  });

  test("chaque tuile porte une icône qui télécharge la pièce, image comprise", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/messages/msg-0001");
    await openFilters(page);
    const message = page.getByRole("article", {
      name: "Message de Amel Benali",
    });
    const icon = message.getByRole("link", {
      name: "Télécharger fraises-abimees.png",
    });
    await expect(icon).toBeVisible();
    const download = page.waitForEvent("download");
    await icon.click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("fraises-abimees.png");
    const bytes = await readFile((await file.path())!);
    expect([...bytes.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    // La page n'a pas changé : on télécharge, on ne quitte pas le message.
    await expect(page).toHaveURL(/\/messages\/msg-0001$/);

    // Un PDF a aussi son icône, qui vise la route du fichier en téléchargement.
    await page.goto("/messages/msg-0003");
    await openFilters(page);
    await expect(
      page.getByRole("link", { name: "Télécharger bon-de-livraison.pdf" }),
    ).toHaveAttribute("href", "/messages/fichiers/upl-0003?telecharger=1");
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
