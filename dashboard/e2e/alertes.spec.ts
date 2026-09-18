import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { E2E_ACCOUNTS } from "../playwright.config";
import { TEST_DATABASE_URL } from "../test/support/config";
import { login } from "./helpers";

/*
 * Notifications en direct : un produit qui passe en stock critique, puis à 0,
 * fait descendre une notification de sous le bandeau, colorée selon sa
 * nature, que la croix ferme et dont le corps mène au produit. Le premier
 * relevé du flux sert de point de départ : on l'attend avant de modifier le
 * stock, et on navigue ensuite SANS recharger la page (le layout garde son
 * état). Le stock est remis comme avant à la fin (base partagée).
 */
async function setStock(page: Page, value: string) {
  await page.getByLabel("Stock (grammes)").fill(value);
  await page
    .getByRole("button", { name: "Enregistrer les modifications" })
    .click();
  await expect(page.getByRole("status").first()).toContainText(/enregistr/i);
}

test("stock critique puis rupture : notification colorée, fermée par la croix, corps cliquable", async ({
  page,
}) => {
  await login(page, E2E_ACCOUNTS.admin);
  const firstFeed = page.waitForResponse(
    (r) => new URL(r.url()).pathname === "/alertes" && r.ok(),
  );
  await page.goto("/catalogue/prd-0001");
  await firstFeed;
  const region = page.getByRole("region", { name: "Notifications" });

  await setStock(page, "1500");
  const low = region.locator('[data-kind="stock_low"]');
  await expect(low).toContainText("Stock critique", { timeout: 15_000 });
  await expect(low).toContainText("Carottes : plus que 1,5");
  await expect(low).toHaveCSS("border-radius", "0px");
  await low.getByRole("button", { name: "Fermer la notification" }).click();
  await expect(low).toHaveCount(0);

  await setStock(page, "0");
  // Navigation dans l'application (sans recharger) : l'alerte suit.
  await page.getByRole("link", { name: "Commandes", exact: true }).click();
  await expect(page).toHaveURL(/\/commandes$/);
  const out = region.locator('[data-kind="stock_out"]');
  await expect(out).toContainText("Rupture de stock", { timeout: 15_000 });
  await out.getByRole("link", { name: /Carottes : stock à 0/ }).click();
  await expect(page).toHaveURL(/\/catalogue\/prd-0001$/);
  await expect(out).toHaveCount(0);

  await setStock(page, "24000");
});

test("une notification part seule après 4 s", async ({ page }) => {
  await login(page, E2E_ACCOUNTS.admin);
  const firstFeed = page.waitForResponse(
    (r) => new URL(r.url()).pathname === "/alertes" && r.ok(),
  );
  await page.goto("/catalogue/prd-0001");
  await firstFeed;
  await setStock(page, "0");
  const out = page
    .getByRole("region", { name: "Notifications" })
    .locator('[data-kind="stock_out"]');
  await expect(out).toBeVisible({ timeout: 15_000 });
  // Le pointeur ailleurs : le décompte n'est pas suspendu.
  await page.mouse.move(0, 400);
  await expect(out).toHaveCount(0, { timeout: 6_000 });
  await setStock(page, "24000");
});

test("plusieurs nouveautés à la fois : UNE seule notification qui les compte", async ({
  page,
}) => {
  const sql = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
  try {
    await login(page, E2E_ACCOUNTS.admin);
    const firstFeed = page.waitForResponse(
      (r) => new URL(r.url()).pathname === "/alertes" && r.ok(),
    );
    await page.goto("/commandes");
    await firstFeed;
    // Deux produits passent à 0 d'un coup (même relevé), comme deux ventes.
    await sql`update products set stock_quantity = 0 where id in ('prd-0001', 'prd-0002')`;
    const region = page.getByRole("region", { name: "Notifications" });
    await expect(region.locator("[data-kind]")).toHaveCount(1, {
      timeout: 15_000,
    });
    await expect(region).toContainText("2 alertes de stock");
    await expect(region.locator("[data-kind]")).toHaveAttribute(
      "data-kind",
      "stock_out",
    );
  } finally {
    await sql`update products set stock_quantity = 24000 where id = 'prd-0001'`;
    await sql`update products set stock_quantity = 18000 where id = 'prd-0002'`;
    await sql.end();
  }
});

test("nouveau message : la section Messages s'illumine avec le compte, puis s'éteint à l'ouverture", async ({
  page,
}) => {
  const sql = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
  try {
    await login(page, E2E_ACCOUNTS.admin);
    const firstFeed = page.waitForResponse(
      (r) => new URL(r.url()).pathname === "/alertes" && r.ok(),
    );
    await page.goto("/commandes");
    await firstFeed;
    await sql`insert into customer_messages (id, customer_id, subject, body)
      values ('msg-e2e-lumiere', 'cli-0001', 'other', 'Bonjour, une question.')`;
    const messages = page
      .locator('[data-slot="sidebar-inner"]')
      .getByRole("link", { name: /^Messages/ });
    await expect(messages).toHaveClass(/nav-lit/, { timeout: 15_000 });
    await expect(messages).toContainText("1");
    await expect(
      page.getByRole("region", { name: "Notifications" }),
    ).toContainText("Nouveau message client");
    await messages.click();
    await expect(page).toHaveURL(/\/messages$/);
    await expect(messages).not.toHaveClass(/nav-lit/);
  } finally {
    await sql`delete from customer_messages where id = 'msg-e2e-lumiere'`;
    await sql.end();
  }
});
