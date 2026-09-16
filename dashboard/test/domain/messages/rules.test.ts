import { describe, expect, it } from "vitest";
import { messagesFixtures } from "@/domain/messages/fixtures";
import {
  filterMessages,
  hasMessageFilters,
  matchesMessageQuery,
  messageFiltersQuery,
  messagePreview,
  receivedDay,
  sortMessages,
} from "@/domain/messages/rules";
import type { Message } from "@/domain/messages/types";

const byId = (id: string): Message =>
  messagesFixtures.find((m) => m.id === id)!;
const ids = (messages: readonly Message[]) => messages.map((m) => m.id);

describe("messagePreview", () => {
  it("garde les deux premières lignes NON VIDES, espaces réduits", () => {
    expect(
      messagePreview("Bonjour,\n\nLes fraises étaient écrasées.\nSuite"),
    ).toBe("Bonjour, Les fraises étaient écrasées.");
    expect(messagePreview("  Une   seule   ligne  ")).toBe("Une seule ligne");
    expect(messagePreview("")).toBe("");
    expect(messagePreview("\n\n\n")).toBe("");
  });

  it("gère les retours à la ligne Windows et le nombre de lignes demandé", () => {
    expect(messagePreview("un\r\ndeux\r\ntrois")).toBe("un deux");
    expect(messagePreview("un\ndeux\ntrois", 3)).toBe("un deux trois");
    expect(messagePreview("un\ndeux\ntrois", 1)).toBe("un");
  });
});

describe("matchesMessageQuery", () => {
  const message = byId("msg-0001");

  it("cherche le nom, l'e-mail, le corps et la référence de la commande", () => {
    for (const query of [
      "amel",
      "BENALI",
      "amel.benali@example.invalid",
      "fraises",
      "écrasée",
      "ecrasee",
      message.order!.reference,
    ]) {
      expect(matchesMessageQuery(message, query)).toBe(true);
    }
  });

  it("une recherche vide ou absente laisse tout passer", () => {
    expect(matchesMessageQuery(message, "")).toBe(true);
    expect(matchesMessageQuery(message, "   ")).toBe(true);
    expect(matchesMessageQuery(message, undefined)).toBe(true);
  });

  it("ne cherche PAS dans le libellé de l'objet : il a son propre filtre", () => {
    // msg-0001 a pour objet « Produit manquant ou abîmé », mais son texte ne
    // contient pas « manquant » : la recherche libre ne doit pas le trouver.
    expect(message.subject).toBe("missing_or_damaged");
    expect(matchesMessageQuery(message, "manquant")).toBe(false);
    expect(matchesMessageQuery(message, "inconnu-xyz")).toBe(false);
  });
});

describe("filterMessages", () => {
  it("chaque critère filtre, et un critère absent laisse tout passer", () => {
    expect(ids(filterMessages(messagesFixtures, {}))).toEqual(
      ids(messagesFixtures),
    );
    expect(
      filterMessages(messagesFixtures, { status: "untreated" }).every(
        (m) => m.status === "untreated",
      ),
    ).toBe(true);
    expect(
      ids(filterMessages(messagesFixtures, { subject: "refund" })),
    ).toEqual(["msg-0005"]);
    expect(
      filterMessages(messagesFixtures, { important: true }).every(
        (m) => m.important,
      ),
    ).toBe(true);
    expect(
      ids(filterMessages(messagesFixtures, { customerId: "cli-0001" })),
    ).toEqual(["msg-0001", "msg-0007"]);
  });

  it("borne la période sur le jour de réception, bornes incluses", () => {
    expect(receivedDay(byId("msg-0001"))).toBe("2026-09-08");
    const window = filterMessages(messagesFixtures, {
      from: "2026-09-06",
      to: "2026-09-08",
    });
    expect(ids(window)).toEqual([
      "msg-0001",
      "msg-0002",
      "msg-0003",
      "msg-0004",
    ]);
    // Bornes incluses : le jour exact des deux extrémités est gardé.
    expect(
      ids(
        filterMessages(messagesFixtures, {
          from: "2026-09-08",
          to: "2026-09-08",
        }),
      ),
    ).toEqual(["msg-0001", "msg-0002"]);
  });

  it("combine les critères (ET, pas OU)", () => {
    expect(
      ids(
        filterMessages(messagesFixtures, {
          status: "untreated",
          important: true,
          query: "tournée",
        }),
      ),
    ).toEqual(["msg-0002"]);
    // Le même mot sans les autres critères ne suffit pas à changer le résultat.
    expect(ids(filterMessages(messagesFixtures, { query: "tournée" }))).toEqual(
      ["msg-0002"],
    );
  });
});

describe("sortMessages", () => {
  it("les épinglés d'abord, puis du plus récent au plus ancien", () => {
    expect(ids(sortMessages(messagesFixtures))).toEqual([
      "msg-0001", // épinglé, bien que reçu avant msg-0002
      "msg-0002",
      "msg-0003",
      "msg-0004",
      "msg-0005",
      "msg-0006",
      "msg-0007",
    ]);
  });

  it("entre deux épinglés, le plus récemment épinglé passe devant", () => {
    const first = { ...byId("msg-0003"), pinnedAt: "2026-09-10T08:00:00.000Z" };
    const second = {
      ...byId("msg-0005"),
      pinnedAt: "2026-09-11T08:00:00.000Z",
    };
    expect(ids(sortMessages([first, second]))).toEqual([
      "msg-0005",
      "msg-0003",
    ]);
  });

  it("ne modifie pas la liste reçue et départage par identifiant", () => {
    const copy = [...messagesFixtures];
    sortMessages(copy);
    expect(ids(copy)).toEqual(ids(messagesFixtures));

    const at = "2026-09-04T10:00:00.000Z";
    const b = { ...byId("msg-0003"), id: "msg-b", receivedAt: at };
    const a = { ...byId("msg-0004"), id: "msg-a", receivedAt: at };
    expect(ids(sortMessages([b, a]))).toEqual(["msg-a", "msg-b"]);
  });
});

describe("hasMessageFilters / messageFiltersQuery", () => {
  it("détecte un filtre actif ; customerId n'en est pas un (il ne vient pas de la barre)", () => {
    expect(hasMessageFilters({})).toBe(false);
    expect(hasMessageFilters({ customerId: "cli-0001" })).toBe(false);
    expect(hasMessageFilters({ query: "amel" })).toBe(true);
    expect(hasMessageFilters({ status: "treated" })).toBe(true);
    expect(hasMessageFilters({ subject: "other" })).toBe(true);
    expect(hasMessageFilters({ from: "2026-09-01" })).toBe(true);
    expect(hasMessageFilters({ to: "2026-09-01" })).toBe(true);
    expect(hasMessageFilters({ important: true })).toBe(true);
  });

  it("réécrit les clés françaises de l'URL, sans les critères absents", () => {
    expect(messageFiltersQuery({})).toBe("");
    expect(messageFiltersQuery({ customerId: "cli-0001" })).toBe("");
    expect(
      decodeURIComponent(
        messageFiltersQuery({
          query: "amel",
          status: "untreated",
          subject: "refund",
          from: "2026-09-01",
          to: "2026-09-08",
          important: true,
        }),
      ),
    ).toBe(
      "q=amel&statut=untreated&objet=refund&du=2026-09-01&au=2026-09-08&important=oui",
    );
  });
});
