import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { customerMessages, messageAttachments } from "@/db/schema";
import { messagesFixtures } from "@/domain/messages/fixtures";
import {
  countComplaints,
  filterMessages,
  sortMessages,
} from "@/domain/messages/rules";
import type { MessageFilters } from "@/domain/messages/types";
import { paginate } from "@/domain/orders/rules";

/*
 * Boîte de réception sur la base de TEST (seedée avec les fixtures), chaque
 * test dans une transaction annulée. Les filtres et la recherche SQL sont
 * comparés à la règle pure filterMessages + sortMessages appliquée à toutes les
 * fixtures : une clause SQL qui ne dirait plus la même chose que le domaine est
 * détectée ici. Les trois écritures sont vérifiées conditionnelles.
 */
vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () =>
  import("../support/test-database").then((m) => m.dbClientMock),
);
const { isolateEachTest, testDb } = await import("../support/test-database");
isolateEachTest();

const { messagesDb } = await import("@/data/messages.db");

const ids = (messages: readonly { id: string }[]) => messages.map((m) => m.id);
/** Assez grand pour tenir toute la boîte seedée en une page. */
const ALL = 100;

/** La règle pure, référence de chaque requête. */
const expected = (filters: MessageFilters) =>
  ids(sortMessages(filterMessages(messagesFixtures, filters)));

const page = async (filters: MessageFilters) =>
  ids((await messagesDb.getMessagesPage(filters, 1, ALL)).items);

describe("messagesDb.getMessagesPage", () => {
  it("renvoie tous les messages seedés, épinglés d'abord puis les plus récents", async () => {
    const items = await page({});
    expect(items).toHaveLength(messagesFixtures.length);
    expect(items).toEqual(expected({}));
    expect(items[0]).toBe("msg-0001"); // le seul épinglé des fixtures
  });

  it("chaque filtre SQL donne exactement la règle pure du domaine", async () => {
    const cases: MessageFilters[] = [
      {},
      { status: "untreated" },
      { status: "treated" },
      { subject: "refund" },
      { subject: "delivery_issue" },
      { important: true },
      { customerId: "cli-0001" },
      { from: "2026-09-06" },
      { to: "2026-09-05" },
      { from: "2026-09-06", to: "2026-09-08" },
      { from: "2026-09-08", to: "2026-09-08" },
      { query: "amel" },
      { query: "BENALI" },
      { query: "écrasée" },
      { query: "ecrasee" },
      { query: "aubergines" },
      { query: "amel.benali@example.invalid" },
      { query: "FIG-260907-001" },
      { query: "introuvable-xyz" },
      // Caractères spéciaux de LIKE : doivent rester du texte.
      { query: "100%" },
      { query: "_" },
      { status: "untreated", important: true, query: "tournée" },
      { subject: "other", from: "2026-09-01", to: "2026-09-30" },
    ];
    for (const filters of cases) {
      expect(await page(filters), JSON.stringify(filters)).toEqual(
        expected(filters),
      );
    }
  });

  it("countMessages compte ce que la liste renvoie", async () => {
    for (const filters of [
      {},
      { status: "untreated" } as MessageFilters,
      { important: true } as MessageFilters,
      { query: "fraises" } as MessageFilters,
    ]) {
      expect(await messagesDb.countMessages(filters)).toBe(
        expected(filters).length,
      );
    }
  });

  it("countComplaints compte les réclamations de la période comme la règle pure", async () => {
    for (const range of [
      { from: "2026-09-05", to: "2026-09-08" },
      { from: "2026-09-01", to: "2026-09-30" },
      { from: "2026-09-06", to: "2026-09-06" },
      { from: "2026-09-08", to: "2026-09-08" },
      { from: "2025-01-01", to: "2025-12-31" },
    ]) {
      expect(
        await messagesDb.countComplaints(range),
        JSON.stringify(range),
      ).toBe(countComplaints(messagesFixtures, range));
    }
    expect(
      await messagesDb.countComplaints({
        from: "2026-09-05",
        to: "2026-09-08",
      }),
    ).toBe(4);
  });

  it("découpe en pages comme paginate, et ramène un numéro hors bornes", async () => {
    const all = expected({});
    for (const n of [1, 2, 3]) {
      const result = await messagesDb.getMessagesPage({}, n, 2);
      const reference = paginate(all, n, 2);
      expect(ids(result.items)).toEqual(reference.items);
      expect(result).toMatchObject({
        page: reference.page,
        pageCount: reference.pageCount,
        total: reference.total,
      });
    }
    // Page 99 : ramenée à la dernière, jamais une page vide.
    const last = await messagesDb.getMessagesPage({}, 99, 2);
    expect(last.page).toBe(last.pageCount);
    expect(last.items.length).toBeGreaterThan(0);
  });
});

describe("messagesDb.getMessage / getCustomerMessages", () => {
  it("rend le message avec son auteur, sa commande et ses pièces jointes en ordre", async () => {
    const message = await messagesDb.getMessage("msg-0001");
    const fixture = messagesFixtures.find((m) => m.id === "msg-0001")!;
    expect(message).toEqual(fixture);
    expect(message!.attachments.map((a) => a.fileName)).toEqual([
      "fraises-abimees.jpg",
      "sac-livraison.jpg",
    ]);
    expect(message!.order?.reference).toBe(fixture.order!.reference);
  });

  it("un message sans commande ni pièce jointe reste lisible", async () => {
    const message = await messagesDb.getMessage("msg-0004");
    expect(message?.order).toBeNull();
    expect(message?.attachments).toEqual([]);
  });

  it("null pour un message inconnu", async () => {
    expect(await messagesDb.getMessage("msg-9999")).toBeNull();
  });

  it("getCustomerMessages : tout, du plus ancien au plus récent (export RGPD)", async () => {
    const messages = await messagesDb.getCustomerMessages("cli-0001");
    expect(ids(messages)).toEqual(["msg-0007", "msg-0001"]);
    expect(await messagesDb.getCustomerMessages("cli-9999")).toEqual([]);
  });
});

describe("écritures conditionnelles", () => {
  const actor = { id: "usr-0002", name: "Gestion E2E" };
  const at = "2026-09-16T09:00:00.000Z";

  it("setMessageStatus écrit qui et quand, et refuse si le statut a changé", async () => {
    const updated = await messagesDb.setMessageStatus("msg-0004", {
      from: "untreated",
      to: "treated",
      actor,
      at,
    });
    expect(updated).toMatchObject({
      status: "treated",
      handledAt: at,
      handledByName: "Gestion E2E",
    });

    // Rejouer avec le même « from » : le statut n'est plus celui-là, rien n'est écrit.
    expect(
      await messagesDb.setMessageStatus("msg-0004", {
        from: "untreated",
        to: "treated",
        actor,
        at: "2027-01-01T00:00:00.000Z",
      }),
    ).toBeNull();
    expect((await messagesDb.getMessage("msg-0004"))?.handledAt).toBe(at);

    expect(
      await messagesDb.setMessageStatus("msg-9999", {
        from: "untreated",
        to: "treated",
        actor,
        at,
      }),
    ).toBeNull();
  });

  it("setMessagePinned épingle, désépingle, et refuse un état de départ périmé", async () => {
    const pinned = await messagesDb.setMessagePinned("msg-0004", {
      from: false,
      to: true,
      at,
    });
    expect(pinned?.pinnedAt).toBe(at);
    // Il est maintenant épinglé : repartir de « non épinglé » n'écrit rien.
    expect(
      await messagesDb.setMessagePinned("msg-0004", {
        from: false,
        to: true,
        at,
      }),
    ).toBeNull();

    const unpinned = await messagesDb.setMessagePinned("msg-0004", {
      from: true,
      to: false,
      at,
    });
    expect(unpinned?.pinnedAt).toBeNull();
  });

  it("setMessageImportant bascule le drapeau et refuse un état périmé", async () => {
    expect(
      (
        await messagesDb.setMessageImportant("msg-0004", {
          from: false,
          to: true,
        })
      )?.important,
    ).toBe(true);
    expect(
      await messagesDb.setMessageImportant("msg-0004", {
        from: false,
        to: true,
      }),
    ).toBeNull();
    expect(
      (
        await messagesDb.setMessageImportant("msg-0004", {
          from: true,
          to: false,
        })
      )?.important,
    ).toBe(false);
  });

  it("un message épinglé remonte en tête de la liste", async () => {
    await messagesDb.setMessagePinned("msg-0006", {
      from: false,
      to: true,
      at: "2026-09-20T10:00:00.000Z",
    });
    const items = await page({});
    // Épinglé le plus récemment : devant msg-0001, épinglé le 8 septembre.
    expect(items.slice(0, 2)).toEqual(["msg-0006", "msg-0001"]);
  });

  it("la base refuse une onzième pièce jointe (limite tenue hors de l'écran)", async () => {
    await expect(
      testDb().insert(messageAttachments).values({
        id: "att-trop",
        messageId: "msg-0001",
        position: 10,
        fileName: "onzieme.jpg",
        contentType: "image/jpeg",
        sizeBytes: 100,
        url: "https://fichiers.fig.invalid/messages/onzieme.jpg",
      }),
    ).rejects.toThrow();
  });

  it("le corps reste cherchable après une écriture (colonne calculée)", async () => {
    await testDb()
      .update(customerMessages)
      .set({ body: "Des myrtilles moisies dans le panier." })
      .where(eq(customerMessages.id, "msg-0004"));
    expect(await page({ query: "myrtilles" })).toEqual(["msg-0004"]);
    expect(await page({ query: "Chantecler" })).toEqual([]);
  });
});
