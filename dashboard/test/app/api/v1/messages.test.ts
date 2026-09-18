import { describe, expect, it, vi } from "vitest";
import {
  messagesFixtures,
  messageUploadsFixtures,
  uploadFixtureBytes,
} from "@/domain/messages/fixtures";
import { ordersFixtures } from "@/domain/orders/fixtures";
import {
  apiRequest,
  params,
  readJson,
  sessionTokenFor,
  TEST_AUTH_SECRET,
  uploadRequest,
} from "../../../support/api";

/*
 * Routes des messages « Nous contacter » de l'API sur la base de test :
 * « mes messages » par curseur (parité avec les fixtures), dépôt idempotent
 * avec des fichiers téléversés d'abord par POST /fichiers, commande jointe et
 * fichiers qui doivent être les miens (et libres), et lecture du dépôt par la
 * boîte de réception du dashboard.
 */
const hoisted = vi.hoisted(() => ({ logged: [] as Record<string, unknown>[] }));
vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () =>
  import("../../../support/test-database").then((m) => m.dbClientMock),
);
vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    DATABASE_URL: "postgresql://fig:fig@localhost:5434/fig_test",
    AUTH_SECRET: "e2e-secret-fig-dashboard-0123456789-abcdef",
  }),
}));
vi.mock("@/data/security-log", () => ({
  logSecurity: (event: Record<string, unknown>) => {
    hoisted.logged.push(event);
  },
}));

const { isolateEachTest } = await import("../../../support/test-database");
isolateEachTest();

const messages = await import("@/app/api/v1/messages/route");
const fichiers = await import("@/app/api/v1/fichiers/route");
const { getMessage, getMessagesPage } = await import("@/data/messages");

const AMEL = "cli-0001";
const key = () => `cle-${crypto.randomUUID()}`;

const PNG = uploadFixtureBytes(messageUploadsFixtures[0]!);
const PDF = uploadFixtureBytes(
  messageUploadsFixtures.find((u) => u.contentType === "application/pdf")!,
);

/** Téléverse un fichier pour la session et renvoie son identifiant. */
async function upload(
  token: string,
  name: string,
  type: string,
  bytes: Uint8Array,
): Promise<string> {
  const res = await fichiers.POST(
    await uploadRequest("/api/v1/fichiers", {
      token,
      files: [{ name, type, bytes }],
      headers: { "idempotency-key": key() },
    }),
    params({}),
  );
  expect(res.status).toBe(201);
  return (await readJson<{ id: string }>(res)).id;
}

/** Dépose un message qui cite ces fichiers ; renvoie la réponse. */
function postMessage(token: string, fileIds: string[]) {
  return messages.POST(
    apiRequest("POST", "/api/v1/messages", {
      token,
      body: { subject: "other", body: "Bonjour", fileIds },
      headers: { "idempotency-key": key() },
    }),
    params({}),
  );
}

type MessageBody = {
  id: string;
  subject: string;
  subjectLabel: string;
  orderId: string | null;
  orderReference: string | null;
  status: string;
  attachments: {
    fileId: string | null;
    fileName: string;
    contentType: string;
    sizeBytes: number;
    url: string;
  }[];
};

describe("GET /api/v1/messages", () => {
  it("liste mes messages, les plus récents d'abord, sans les marques internes", async () => {
    const token = await sessionTokenFor(AMEL, TEST_AUTH_SECRET);
    const expected = messagesFixtures
      .filter((m) => m.customer.id === AMEL)
      .toSorted(
        (a, b) =>
          b.receivedAt.localeCompare(a.receivedAt) || b.id.localeCompare(a.id),
      );
    expect(expected.length).toBeGreaterThan(0);
    const res = await messages.GET(
      apiRequest("GET", "/api/v1/messages", { token }),
      params({}),
    );
    expect(res.status).toBe(200);
    const body = await readJson<{
      items: MessageBody[];
      nextCursor: string | null;
    }>(res);
    expect(body.items.map((m) => m.id)).toEqual(expected.map((m) => m.id));
    expect(body.nextCursor).toBeNull();
    expect("pinnedAt" in body.items[0]!).toBe(false);
    expect("important" in body.items[0]!).toBe(false);
  });
});

describe("POST /api/v1/messages", () => {
  it("dépose une demande avec ses fichiers téléversés, visible dans la boîte de réception, et la rejoue à l'identique", async () => {
    const token = await sessionTokenFor(AMEL, TEST_AUTH_SECRET);
    const mine = ordersFixtures.find((o) => o.customer.id === AMEL)!;
    const photo = await upload(token, "panier.png", "image/png", PNG);
    const ticket = await upload(token, "ticket.pdf", "application/pdf", PDF);
    const message = {
      subject: "missing_or_damaged",
      body: "Il manquait les fraises dans mon panier.\nMerci d'avance.",
      orderId: mine.id,
      // Dans l'ordre voulu, qui n'est pas celui du téléversement.
      fileIds: [ticket, photo],
    };
    const k = key();
    const created = await messages.POST(
      apiRequest("POST", "/api/v1/messages", {
        token,
        body: message,
        headers: { "idempotency-key": k },
      }),
      params({}),
    );
    expect(created.status).toBe(201);
    const body = await readJson<MessageBody>(created);
    expect(body).toMatchObject({
      subject: "missing_or_damaged",
      subjectLabel: "Produit manquant ou abîmé",
      orderId: mine.id,
      orderReference: mine.reference,
      status: "untreated",
    });
    expect(body.attachments).toEqual([
      expect.objectContaining({
        fileId: ticket,
        fileName: "ticket.pdf",
        contentType: "application/pdf",
        sizeBytes: PDF.length,
        url: `/api/v1/fichiers/${ticket}`,
      }),
      expect.objectContaining({
        fileId: photo,
        fileName: "panier.png",
        contentType: "image/png",
        sizeBytes: PNG.length,
        url: `/api/v1/fichiers/${photo}`,
      }),
    ]);
    expect(hoisted.logged.at(-1)).toMatchObject({
      type: "api_message_created",
      messageId: body.id,
    });

    const stored = await getMessage(body.id);
    expect(stored?.customer.id).toBe(AMEL);
    expect(stored?.attachments.map((a) => a.uploadId)).toEqual([ticket, photo]);
    expect(stored?.order?.id).toBe(mine.id);
    const inbox = await getMessagesPage({ status: "untreated" }, 1);
    expect(inbox.items.some((m) => m.id === body.id)).toBe(true);

    const replay = await messages.POST(
      apiRequest("POST", "/api/v1/messages", {
        token,
        body: message,
        headers: { "idempotency-key": k },
      }),
      params({}),
    );
    expect(replay.status).toBe(201);
    expect(replay.headers.get("Idempotent-Replayed")).toBe("true");
    expect((await readJson<MessageBody>(replay)).id).toBe(body.id);
  });

  it("refuse la commande d'un autre client, l'ancienne forme des pièces jointes, et l'absence de clé", async () => {
    const token = await sessionTokenFor(AMEL, TEST_AUTH_SECRET);
    const other = ordersFixtures.find((o) => o.customer.id !== AMEL)!;
    const foreign = await messages.POST(
      apiRequest("POST", "/api/v1/messages", {
        token,
        body: { subject: "other", body: "Bonjour", orderId: other.id },
        headers: { "idempotency-key": key() },
      }),
      params({}),
    );
    expect(foreign.status).toBe(422);
    expect((await readJson(foreign)).error).toMatchObject({
      code: "order_not_owned",
    });

    // Métadonnées et URL chez l'application : refusé, jamais ignoré en silence.
    const legacy = await messages.POST(
      apiRequest("POST", "/api/v1/messages", {
        token,
        body: {
          subject: "other",
          body: "Bonjour",
          attachments: [
            {
              fileName: "v.jpg",
              contentType: "image/jpeg",
              sizeBytes: 10,
              url: "https://x.invalid/v.jpg",
            },
          ],
        },
        headers: { "idempotency-key": key() },
      }),
      params({}),
    );
    expect(legacy.status).toBe(422);
    expect((await readJson(legacy)).error).toMatchObject({
      code: "validation_failed",
    });

    const noKey = await messages.POST(
      apiRequest("POST", "/api/v1/messages", {
        token,
        body: { subject: "other", body: "Bonjour" },
      }),
      params({}),
    );
    expect(noKey.status).toBe(400);
  });

  it("refuse un fichier d'une autre personne, déjà joint, inconnu ou cité deux fois, sans rien créer", async () => {
    const token = await sessionTokenFor(AMEL, TEST_AUTH_SECRET);
    const free = await upload(token, "libre.png", "image/png", PNG);
    const foreign = messageUploadsFixtures.find((u) => u.customerId !== AMEL)!;
    const attached = messageUploadsFixtures.find((u) => u.customerId === AMEL)!;
    const before = (await getMessagesPage({}, 1)).total;

    for (const fileIds of [
      [free, foreign.id],
      [attached.id],
      ["upl-inconnu"],
      [free, free],
    ]) {
      const res = await postMessage(token, fileIds);
      expect(res.status).toBe(422);
      expect((await readJson(res)).error).toMatchObject({
        code: "attachment_unavailable",
      });
    }
    expect((await getMessagesPage({}, 1)).total).toBe(before);

    // Le fichier libre l'est resté : un envoi correct le joint, une seule fois.
    expect((await postMessage(token, [free])).status).toBe(201);
    expect((await postMessage(token, [free])).status).toBe(422);
  });
});
