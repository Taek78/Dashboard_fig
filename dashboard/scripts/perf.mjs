import { chromium } from "@playwright/test";

/*
 * Mesure de performance des écrans (à lancer contre un serveur de production,
 * ex. `npx next start -p 3124`) : temps serveur, premier rendu, plus grand
 * élément peint, poids du JavaScript transféré, par page, en navigateur froid
 * puis sur une navigation client. Usage :
 *   node scripts/perf.mjs http://localhost:3124 admin@fig-demo.invalid mot-de-passe
 */
const [base = "http://localhost:3124", email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error("Usage : node scripts/perf.mjs <url> <email> <mot de passe>");
  process.exit(1);
}

const PAGES = [
  "/",
  "/commandes",
  "/livraisons?date=2026-09-07",
  "/catalogue",
  "/articles",
  "/clients?tous=1",
  "/metriques",
  "/commandes/cmd-0001",
];

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1366, height: 900 },
});
const page = await context.newPage();

await page.goto(`${base}/connexion`);
await page.getByLabel("E-mail").fill(email);
await page.getByLabel("Mot de passe").fill(password);
await page.getByRole("button", { name: "Se connecter" }).click();
await page.waitForURL(`${base}/`);

async function measure(path) {
  let jsBytes = 0;
  let requests = 0;
  const pending = [];
  const onResponse = (response) => {
    requests += 1;
    const type = response.headers()["content-type"] ?? "";
    if (type.includes("javascript")) {
      // Poids réel du corps (les chunks Next arrivent sans content-length).
      pending.push(
        response
          .body()
          .then((body) => {
            jsBytes += body.length;
          })
          .catch(() => {}),
      );
    }
  };
  page.on("response", onResponse);
  await page.goto(`${base}${path}`, { waitUntil: "load" });
  const metrics = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const nav = performance.getEntriesByType("navigation")[0];
        const paints = Object.fromEntries(
          performance
            .getEntriesByType("paint")
            .map((p) => [p.name, p.startTime]),
        );
        let lcp = 0;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) lcp = entry.startTime;
        });
        observer.observe({ type: "largest-contentful-paint", buffered: true });
        setTimeout(() => {
          observer.disconnect();
          resolve({
            ttfb: Math.round(nav.responseStart - nav.requestStart),
            dcl: Math.round(nav.domContentLoadedEventEnd),
            load: Math.round(nav.loadEventEnd),
            fcp: Math.round(paints["first-contentful-paint"] ?? 0),
            lcp: Math.round(lcp),
            domNodes: document.querySelectorAll("*").length,
          });
        }, 800);
      }),
  );
  page.off("response", onResponse);
  await Promise.all(pending);
  return { path, ...metrics, requests, jsKb: Math.round(jsBytes / 1024) };
}

const rows = [];
for (const path of PAGES) rows.push(await measure(path));
console.table(rows);

// Fluidité : temps d'une navigation client et coût d'un défilement.
await page.goto(`${base}/commandes`);
const navStart = Date.now();
await page.getByRole("link", { name: "Métriques" }).first().click();
await page.getByRole("heading", { level: 1, name: "Métriques" }).waitFor();
console.log(
  `navigation client /commandes → /metriques : ${Date.now() - navStart} ms`,
);

const longTasks = await page.evaluate(
  () =>
    new Promise((resolve) => {
      let total = 0;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) total += entry.duration;
      });
      observer.observe({ type: "longtask", buffered: true });
      window.scrollTo(0, 2000);
      setTimeout(() => {
        window.scrollTo(0, 0);
        setTimeout(() => {
          observer.disconnect();
          resolve(Math.round(total));
        }, 500);
      }, 500);
    }),
);
console.log(
  `tâches longues pendant un défilement sur /metriques : ${longTasks} ms`,
);

await browser.close();
