import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Note interne sur un client, de bout en bout sur la base de test : session
 * simulée (rôle pilotable), server-only neutralisé, revalidatePath espionné.
 * Chaque test dans une transaction annulée.
 */
const session = vi.hoisted(() => ({ role: "gestionnaire" }));
vi.mock("@/data/session", () => ({
  getCurrentUser: async () => ({
    id: "usr-0002",
    name: "Gestion E2E",
    role: session.role,
  }),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () =>
  import("../../support/test-database").then((m) => m.dbClientMock),
);
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

const { isolateEachTest } = await import("../../support/test-database");
isolateEachTest();

const { addCustomerNote, anonymizeCustomerData } =
  await import("@/app/(dashboard)/clients/[id]/actions");
const { getCustomer } = await import("@/data/customers");
const { idleActionResult } = await import("@/lib/action-result");

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.append(k, v);
  return data;
}

const run = (fields: Record<string, string>) =>
  addCustomerNote(idleActionResult, form(fields));

beforeEach(() => {
  session.role = "gestionnaire";
  revalidatePath.mockClear();
});

describe("addCustomerNote", () => {
  it("ajoute une note signée par l'utilisateur de la session, datée par le serveur", async () => {
    expect(
      await run({ customerId: "cli-0003", text: "  Rappeler lundi.  " }),
    ).toEqual({ status: "success", message: "Note ajoutée." });
    const c = await getCustomer("cli-0003");
    expect(c?.notes).toHaveLength(1);
    expect(c?.notes[0]).toMatchObject({
      text: "Rappeler lundi.",
      authorName: "Gestion E2E",
    });
    expect(new Date(c!.notes[0]!.createdAt).toISOString()).toBe(
      c!.notes[0]!.createdAt,
    );
    expect(revalidatePath).toHaveBeenCalledWith("/clients", "layout");
  });

  it("ignore un auteur ou une date envoyés par le formulaire", async () => {
    await run({
      customerId: "cli-0003",
      text: "x",
      authorName: "Pirate",
      createdAt: "1999-01-01T00:00:00.000Z",
    });
    const note = (await getCustomer("cli-0003"))!.notes[0]!;
    expect(note.authorName).toBe("Gestion E2E");
    expect(note.createdAt.startsWith("1999")).toBe(false);
  });

  it("refuse une note vide ou un client inconnu", async () => {
    expect((await run({ customerId: "cli-0003", text: "   " })).status).toBe(
      "error",
    );
    expect(await run({ customerId: "cli-9999", text: "ok" })).toEqual({
      status: "error",
      message: "Ce client n'existe plus.",
    });
  });
});

describe("anonymizeCustomerData", () => {
  const anonymize = (fields: Record<string, string>) =>
    anonymizeCustomerData(idleActionResult, form(fields));

  it("refuse tout autre rôle que l'administrateur, sans rien écrire", async () => {
    for (const role of ["gestionnaire", "lecture", "livreur"]) {
      session.role = role;
      expect(
        await anonymize({ customerId: "cli-0004", confirm: "ANONYMISER" }),
      ).toEqual({
        status: "error",
        message: "Seul un administrateur peut anonymiser un client.",
      });
    }
    expect((await getCustomer("cli-0004"))?.anonymizedAt).toBeNull();
  });

  it("exige le mot ANONYMISER côté serveur", async () => {
    session.role = "admin";
    expect(
      await anonymize({ customerId: "cli-0004", confirm: "oui" }),
    ).toMatchObject({ status: "error" });
    expect((await getCustomer("cli-0004"))?.anonymizedAt).toBeNull();
  });

  it("refuse tant qu'une commande est en préparation ou expédiée", async () => {
    session.role = "admin";
    // cli-0004 : cmd-0004 expédiée.
    expect(
      await anonymize({ customerId: "cli-0004", confirm: "ANONYMISER" }),
    ).toEqual({
      status: "error",
      message:
        "Ce client a encore une commande en préparation ou expédiée : anonymisez-le une fois ses commandes livrées ou annulées.",
    });
    expect((await getCustomer("cli-0004"))?.anonymizedAt).toBeNull();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("anonymise, revalide toutes les pages, puis refuse de recommencer", async () => {
    session.role = "admin";
    // cli-0005 : aucune commande ouverte.
    expect(
      await anonymize({ customerId: "cli-0005", confirm: " anonymiser " }),
    ).toEqual({
      status: "success",
      message:
        "Client anonymisé : identité, coordonnées et notes effacées, commandes conservées.",
    });
    const customer = await getCustomer("cli-0005");
    expect(customer).toMatchObject({
      fullName: "Client anonymisé",
      phone: "",
      notes: [],
    });
    expect(customer?.anonymizedAt).not.toBeNull();
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");

    expect(
      await anonymize({ customerId: "cli-0005", confirm: "ANONYMISER" }),
    ).toEqual({ status: "error", message: "Ce client est déjà anonymisé." });
    expect(
      await anonymize({ customerId: "cli-9999", confirm: "ANONYMISER" }),
    ).toEqual({ status: "error", message: "Ce client n'existe plus." });
  });

  it("une note ne peut plus être ajoutée à un client anonymisé", async () => {
    session.role = "admin";
    await anonymize({ customerId: "cli-0005", confirm: "ANONYMISER" });
    session.role = "gestionnaire";
    expect(await run({ customerId: "cli-0005", text: "Rappeler" })).toEqual({
      status: "error",
      message:
        "Ce client est anonymisé : aucune note ne peut lui être ajoutée.",
    });
  });
});
