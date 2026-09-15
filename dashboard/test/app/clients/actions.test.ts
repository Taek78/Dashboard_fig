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

const { addCustomerNote } =
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
