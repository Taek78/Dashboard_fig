import { expect, test, type APIRequestContext } from "@playwright/test";
import { todayInParis } from "../src/domain/deliveries/rules";
import { addDays } from "../src/lib/days";
import { E2E_ACCOUNTS } from "../playwright.config";
import { login } from "./helpers";
import { codeIn, waitForMail } from "./mail";

/*
 * L'API de l'application, de bout en bout contre le serveur construit : une
 * personne s'inscrit par le code reçu par mail, lit le catalogue (ETag), fait
 * un devis, passe une commande payée avec une clé d'idempotence, la retrouve
 * dans le dashboard (l'équipe la voit aussitôt), l'annule depuis
 * l'application, et le dashboard montre le motif « Annulée par le client ».
 * Puis la clé de service lit la file des notifications. Les mails sont lus
 * dans le dossier du transport « fichier » (e2e/mail.ts). Mode série : les
 * étapes s'enchaînent sur le même compte.
 */
const SERVICE_KEY = "e2e-cle-de-service-fig-dashboard-0123456789";

type Catalog = {
  products: {
    id: string;
    name: string;
    unit: "g" | "piece";
    saleStatus: string;
  }[];
};
type Quote = { totalCents: number; deliveryFeeCents: number };
type Order = {
  id: string;
  reference: string;
  status: string;
  cancellation: { label: string } | null;
};

test.describe("API de l'application", () => {
  test.describe.configure({ mode: "serial" });

  const stamp = Date.now();
  const email = `e2e-api-${stamp}@fig-demo.invalid`;
  let token = "";
  let order: Order | null = null;

  async function requestCode(request: APIRequestContext): Promise<string> {
    const since = new Date().toISOString();
    const res = await request.post("/api/v1/auth/code", { data: { email } });
    expect(res.status()).toBe(202);
    const mail = await waitForMail(email, {
      subject: /code de connexion/i,
      since,
    });
    return codeIn(mail);
  }

  test("inscription par le code reçu par mail, puis profil", async ({
    request,
  }) => {
    const code = await requestCode(request);
    const needSignup = await request.post("/api/v1/auth/session", {
      data: { email, code },
    });
    expect(needSignup.status()).toBe(404);
    expect((await needSignup.json()).error.code).toBe("signup_required");

    const created = await request.post("/api/v1/auth/session", {
      data: {
        email,
        code,
        signup: {
          fullName: `Client API ${stamp % 10_000}`,
          phone: "06 39 98 00 99",
          addressLine: "5 rue de l'Orme",
          city: "Paris",
          postalCode: "75011",
          consents: { offers: false, orderStatus: true, marketing: false },
        },
      },
    });
    expect(created.status()).toBe(201);
    const session = await created.json();
    expect(session.created).toBe(true);
    expect(session.customer.email).toBe(email);
    token = session.token;

    const me = await request.get("/api/v1/me", {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(me.status()).toBe(200);
    expect(me.headers()["cache-control"]).toBe("private, no-store");
    expect((await me.json()).loyalty.count).toBe(0);
    const anonymous = await request.get("/api/v1/me");
    expect(anonymous.status()).toBe(401);
  });

  test("catalogue avec ETag, devis, commande idempotente visible par l'équipe", async ({
    request,
    page,
  }) => {
    const catalogue = await request.get("/api/v1/catalogue");
    expect(catalogue.status()).toBe(200);
    expect(catalogue.headers()["cache-control"]).toContain("public");
    const etag = catalogue.headers().etag;
    expect(etag).toBeTruthy();
    const unchanged = await request.get("/api/v1/catalogue", {
      headers: { "if-none-match": etag! },
    });
    expect(unchanged.status()).toBe(304);
    const { products } = (await catalogue.json()) as Catalog;
    const product = products.find(
      (p) => p.saleStatus === "en_vente" && p.unit === "g",
    )!;
    const lines = [{ productId: product.id, quantity: 1500 }];

    const headers = { authorization: `Bearer ${token}` };
    const quote = await request.post("/api/v1/commandes/devis", {
      headers,
      data: { lines },
    });
    expect(quote.status()).toBe(200);
    const { totalCents } = (await quote.json()) as Quote;

    // Demain à Paris : l'arithmétique UTC (Date.now() + 1 jour, toISOString)
    // retombe sur le jour courant autour de minuit, heure de Paris, et la
    // commande troublerait le tableau de bord d'« aujourd'hui ».
    const tomorrow = addDays(todayInParis(new Date()), 1);
    const body = {
      lines,
      deliverySlot: { date: tomorrow, start: "14:00" },
      expectedTotalCents: totalCents,
      paymentReference: `e2e-pay-${stamp}`,
    };
    const key = `e2e-${stamp}-commande`;
    const created = await request.post("/api/v1/commandes", {
      headers: { ...headers, "idempotency-key": key },
      data: body,
    });
    expect(created.status()).toBe(201);
    order = (await created.json()) as Order;
    expect(order.reference).toMatch(/^FIG-\d{6}-\d{3,}$/);

    const replayed = await request.post("/api/v1/commandes", {
      headers: { ...headers, "idempotency-key": key },
      data: body,
    });
    expect(replayed.status()).toBe(201);
    expect(replayed.headers()["idempotent-replayed"]).toBe("true");
    expect(((await replayed.json()) as Order).id).toBe(order.id);

    // L'équipe la voit dans le dashboard, avec le nom du produit et le total.
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto(`/commandes?q=${order.reference}`);
    await page.getByRole("link", { name: order.reference }).click();
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: `Commande ${order.reference}`,
      }),
    ).toBeVisible();
    await expect(page.getByText(product.name).first()).toBeVisible();
  });

  test("téléversement d'une photo par l'application, relue à l'octet près ; un contenu qui ment est refusé", async ({
    request,
  }) => {
    // Une image PNG 1 × 1, écrite à la main.
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR42mP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
      "base64",
    );
    const headers = { authorization: `Bearer ${token}` };
    const sent = await request.post("/api/v1/fichiers", {
      headers: { ...headers, "idempotency-key": `e2e-${stamp}-fichier` },
      multipart: {
        fichier: { name: "panier.png", mimeType: "image/png", buffer: png },
      },
    });
    expect(sent.status()).toBe(201);
    const uploaded = (await sent.json()) as { id: string; url: string };
    expect(uploaded.url).toBe(`/api/v1/fichiers/${uploaded.id}`);

    const read = await request.get(uploaded.url, { headers });
    expect(read.status()).toBe(200);
    expect(read.headers()["content-type"]).toBe("image/png");
    expect(read.headers()["cache-control"]).toBe("private, no-store");
    expect(Buffer.from(await read.body()).equals(png)).toBe(true);
    expect((await request.get(uploaded.url)).status()).toBe(401);

    const lying = await request.post("/api/v1/fichiers", {
      headers: { ...headers, "idempotency-key": `e2e-${stamp}-mensonge` },
      multipart: {
        fichier: {
          name: "photo.png",
          mimeType: "image/png",
          buffer: Buffer.from("<script>alert(1)</script>"),
        },
      },
    });
    expect(lying.status()).toBe(422);
    expect((await lying.json()).error.code).toBe("content_type_mismatch");
  });

  test("annulation depuis l'application, motif visible par l'équipe ; file de service", async ({
    request,
    page,
  }) => {
    const headers = { authorization: `Bearer ${token}` };
    const cancelled = await request.post(
      `/api/v1/commandes/${order!.id}/annulation`,
      {
        headers,
        data: { detail: "Absent demain" },
      },
    );
    expect(cancelled.status()).toBe(200);
    const after = (await cancelled.json()) as Order;
    expect(after.status).toBe("cancelled");
    expect(after.cancellation?.label).toBe("Annulée par le client");

    await login(page, E2E_ACCOUNTS.manager);
    await page.goto(`/commandes/${order!.id}`);
    await expect(page.getByLabel("Statut de la commande")).toHaveValue(
      "cancelled",
    );
    await expect(page.getByText("Annulée par le client").first()).toBeVisible();

    const forbidden = await request.get("/api/v1/service/notifications");
    expect(forbidden.status()).toBe(401);
    const pending = await request.get("/api/v1/service/notifications", {
      headers: { authorization: `Bearer ${SERVICE_KEY}` },
    });
    expect(pending.status()).toBe(200);
    expect(Array.isArray((await pending.json()).items)).toBe(true);

    const closed = await request.delete("/api/v1/auth/session", { headers });
    expect(closed.status()).toBe(204);
    expect((await request.get("/api/v1/me", { headers })).status()).toBe(401);
  });
});
