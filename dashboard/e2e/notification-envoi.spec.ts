import { expect, test } from "@playwright/test";
import { E2E_ACCOUNTS } from "../playwright.config";
import { login } from "./helpers";

/*
 * « Client notifié » suivi jusqu'à l'accusé de l'application (demande du
 * 2026-09-18) : spinner pendant l'attente, échec déclaré par l'application
 * (route de service) → « Échec d'envoi de la notification » et « Réessayer »,
 * qui relance l'attente ; l'accusé d'envoi éteint le spinner. La clé de
 * service est la valeur PUBLIQUE posée par playwright.config.ts. Commande
 * d'Amel (notifications autorisées) ; son statut d'origine est remis à la
 * fin, sans notifier (base partagée, un autre parcours la fait avancer).
 */
const SERVICE_KEY = "e2e-cle-de-service-fig-dashboard-0123456789";
const service = { authorization: `Bearer ${SERVICE_KEY}` };

test("spinner jusqu'à l'accusé, échec puis « Réessayer », enfin envoyée", async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);
  await login(page, E2E_ACCOUNTS.manager);
  await page.goto("/commandes?q=FIG-260907-001");
  await page.getByRole("link", { name: "FIG-260907-001" }).first().click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Commande FIG-260907-001" }),
  ).toBeVisible();

  const select = page.getByLabel("Statut de la commande");
  const original = await select.inputValue();
  const next = original === "delivering" ? "preparing" : "delivering";
  // Cochée d'office sauf après une livraison : on la coche explicitement.
  await page.getByLabel("Notifier le client").check();
  await select.selectOption(next);
  const badge = page
    .getByRole("status")
    .filter({ hasText: /Client notifié|Échec d'envoi/ })
    .last();
  await expect(badge).toContainText("Client notifié");
  await expect(badge).toContainText("en attente de l'accusé d'envoi");

  // Le serveur de l'application déclare l'échec.
  const queue = (await (
    await request.get("/api/v1/service/notifications", { headers: service })
  ).json()) as {
    items: { id: string; orderReference: string; orderStatus: string }[];
  };
  // La file est dans l'ordre de dépôt : la nôtre est la DERNIÈRE de cette
  // commande à ce statut (un autre parcours a pu en laisser une plus ancienne).
  const target = queue.items.findLast(
    (n) => n.orderReference === "FIG-260907-001" && n.orderStatus === next,
  );
  expect(target).toBeDefined();
  const failed = await request.post(
    `/api/v1/service/notifications/${target!.id}/echec`,
    { headers: service, data: { raison: "Téléphone injoignable" } },
  );
  expect(failed.status()).toBe(200);
  await expect(badge).toContainText("Échec d'envoi de la notification", {
    timeout: 10_000,
  });

  // « Réessayer » : de nouveau en attente, puis l'accusé d'envoi.
  await badge
    .getByRole("button", { name: "Réessayer l'envoi de la notification" })
    .click();
  await expect(badge).toContainText("en attente de l'accusé d'envoi");
  const sent = await request.post(
    `/api/v1/service/notifications/${target!.id}/envoi`,
    { headers: service },
  );
  expect(sent.status()).toBe(200);
  await expect(badge).toContainText("Client notifié");
  await expect(badge).not.toContainText("en attente", { timeout: 10_000 });

  // Statut d'origine, sans notifier.
  await page.getByLabel("Notifier le client").uncheck();
  await select.selectOption(original);
  await expect(select).toHaveValue(original);
});
