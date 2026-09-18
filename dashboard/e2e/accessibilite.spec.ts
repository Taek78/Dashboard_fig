import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { E2E_ACCOUNTS } from "../playwright.config";
import { login } from "./helpers";

/*
 * Accessibilité automatisée (axe-core, décision du 2026-09-17) : chaque écran
 * principal est analysé avec les règles WCAG 2.x A et AA et les bonnes
 * pratiques d'axe. Seules les violations d'impact « serious » ou « critical »
 * font échouer la suite ; les autres (« moderate », « minor ») sont jointes au
 * rapport pour être traitées au fil de l'eau, sans bloquer la CI au départ.
 * Ce que l'outil ne voit pas : l'ordre de lecture réel, la pertinence des
 * libellés, la navigation au clavier de bout en bout (parcours à part).
 */
const BLOCKING = new Set(["serious", "critical"]);
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];

const PUBLIC_PAGES = [
  "/connexion",
  "/connexion/recuperation",
  "/connexion/adresse-oubliee",
];
const ADMIN_PAGES = [
  "/",
  "/commandes",
  "/catalogue",
  "/articles",
  "/clients",
  "/messages",
  "/messages/msg-0001",
  "/personnel",
  "/metriques",
  "/comptes",
  "/profil",
];

type Violation = {
  id: string;
  impact: string | null | undefined;
  help: string;
  nodes: { target: unknown[] }[];
};

const summarize = (v: Violation) => ({
  id: v.id,
  impact: v.impact ?? "inconnu",
  help: v.help,
  nodes: v.nodes.slice(0, 5).map((n) => n.target.join(" ")),
});

async function checkPage(page: Page, path: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const violations = results.violations as Violation[];
  const blocking = violations.filter((v) => BLOCKING.has(v.impact ?? ""));
  const others = violations.filter((v) => !BLOCKING.has(v.impact ?? ""));
  if (others.length > 0) {
    await test.info().attach(`axe${path.replaceAll("/", "-") || "-accueil"}`, {
      body: JSON.stringify(others.map(summarize), null, 2),
      contentType: "application/json",
    });
  }
  expect
    .soft(blocking.map(summarize), `violations sérieuses sur ${path}`)
    .toEqual([]);
}

test.describe("accessibilité (axe-core)", () => {
  test("les pages publiques n'ont aucune violation sérieuse", async ({
    page,
  }) => {
    for (const path of PUBLIC_PAGES) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await checkPage(page, path);
    }
  });

  test("les écrans principaux, connecté en administrateur, n'ont aucune violation sérieuse", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await login(page, E2E_ACCOUNTS.admin);
    for (const path of ADMIN_PAGES) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await checkPage(page, path);
    }
    // Une fiche de commande et une fiche client : les premières listées.
    for (const [list, prefix] of [
      ["/commandes", "/commandes/"],
      ["/clients", "/clients/"],
    ] as const) {
      await page.goto(list);
      const link = page.locator(`main a[href^="${prefix}"]`).first();
      if ((await link.count()) === 0) continue;
      const href = await link.getAttribute("href");
      await page.goto(href!);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await checkPage(page, href!);
    }
  });
});
