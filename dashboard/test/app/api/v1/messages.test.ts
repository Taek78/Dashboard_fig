import { describe, expect, it, vi } from "vitest";
import { messagesFixtures } from "@/domain/messages/fixtures";
import { ordersFixtures } from "@/domain/orders/fixtures";
import {
  apiRequest,
  params,
  readJson,
  sessionTokenFor,
  TEST_AUTH_SECRET,
} from "../../../support/api";

/*
 * Routes des messages « Nous contacter » de l'API sur la base de test :
 * « mes messages » par curseur (parité avec les fixtures), dépôt idempotent
 * avec pièces jointes, commande jointe qui doit être la mienne, et lecture
 * du dépôt par la boîte de réception du dashboard.
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
const { getMessage, getMessagesPage } = await import("@/data/messages");

const AMEL = "cli-0001";
const key = () => `cle-${crypto.randomUUID()}`;

type MessageBody = {
  id: string;
  subject: string;
  subjectLabel: string;
  orderId: string | null;
  orderReference: string | null;
  status: string;
  attachments: { fileName: string; contentType: string; url: string }[];
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
  it("dépose une demande avec ses pièces jointes, visible dans la boîte de réception, et la rejoue à l'identique", async () => {
    const token = await sessionTokenFor(AMEL, TEST_AUTH_SECRET);
    const mine = ordersFixtures.find((o) => o.customer.id === AMEL)!;
    const message = {
      subject: "missing_or_damaged",
      body: "Il manquait les fraises dans mon panier.\nMerci d'avance.",
      orderId: mine.id,
      attachments: [
        {
          fileName: "panier.jpg",
          contentType: "image/jpeg",
          sizeBytes: 240_000,
          url: "https://fichiers.fig.invalid/messages/panier.jpg",
        },
        {
          fileName: "ticket.pdf",
          contentType: "application/pdf",
          sizeBytes: 12_000,
          url: "https://fichiers.fig.invalid/messages/ticket.pdf",
        },
      ],
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
    expect(body.attachments.map((a) => a.fileName)).toEqual([
      "panier.jpg",
      "ticket.pdf",
    ]);
    expect(hoisted.logged.at(-1)).toMatchObject({
      type: "api_message_created",
      messageId: body.id,
    });

    const stored = await getMessage(body.id);
    expect(stored?.customer.id).toBe(AMEL);
    expect(stored?.attachments).toHaveLength(2);
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

  it("refuse la commande d'un autre client, un format de fichier hors liste, et l'absence de clé", async () => {
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

    const video = await messages.POST(
      apiRequest("POST", "/api/v1/messages", {
        token,
        body: {
          subject: "other",
          body: "Bonjour",
          attachments: [
            {
              fileName: "v.mp4",
              contentType: "video/mp4",
              sizeBytes: 10,
              url: "https://x.invalid/v.mp4",
            },
          ],
        },
        headers: { "idempotency-key": key() },
      }),
      params({}),
    );
    expect(video.status).toBe(422);
    expect((await readJson(video)).error).toMatchObject({
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
});
