import { expect, test } from "@playwright/test";
import { E2E_ACCOUNTS } from "../playwright.config";
import { login } from "./helpers";

test.describe("articles", () => {
  test("rédiger un article l'ajoute à l'historique, puis on peut le masquer", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/articles");
    const title = `Article de test ${Date.now()}`;
    await page.getByLabel("Titre").fill(title);
    await page.getByLabel("Catégorie").selectOption("recipe");
    await page
      .getByLabel("Texte")
      .fill("Un texte de test.\n\nUn second paragraphe.");
    await page.getByRole("button", { name: "Publier l'article" }).click();
    await expect(page.getByRole("status").first()).toContainText(
      `Article « ${title} » publié.`,
    );

    const card = page.getByRole("article", { name: title });
    await expect(card).toContainText("Recette");
    await card.getByRole("button", { name: "Masquer" }).click();
    await expect(card).toContainText("Masqué");
  });
});
