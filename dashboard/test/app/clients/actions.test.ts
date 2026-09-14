import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { customersMock, resetCustomersMock } from "@/data/customers.mock";

/*
 * Session simulée : getCurrentUser() (Auth.js) est remplacé par un
 * utilisateur de test dont le rôle est pilotable par cas (session.role).
 */
const session = vi.hoisted(() => ({ role: "gestionnaire" }));
vi.mock("@/data/session", () => ({
  getCurrentUser: async () => ({
    id: "usr-test",
    name: "Testeur",
    role: session.role,
  }),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ getEnv: () => ({ DATA_SOURCE: "mock" }) }));
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

const { addCustomerNote } =
  await import("@/app/(dashboard)/clients/[id]/actions");
const { idleActionResult } = await import("@/lib/action-result");

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.append(k, v);
  return data;
}

async function run(fields: Record<string, string>) {
  const promise = addCustomerNote(idleActionResult, form(fields));
  await vi.advanceTimersByTimeAsync(2000);
  return promise;
}

beforeEach(() => {
  vi.useFakeTimers();
  session.role = "gestionnaire";
  resetCustomersMock();
  revalidatePath.mockClear();
});
afterEach(() => vi.useRealTimers());

describe("addCustomerNote", () => {
  it("ajoute une note signée par l'utilisateur de la session, datée par le serveur", async () => {
    const r = await run({
      customerId: "cli-0003",
      text: "  Rappeler lundi.  ",
    });
    expect(r).toEqual({ status: "success", message: "Note ajoutée." });
    const p = customersMock.getCustomer("cli-0003");
    await vi.advanceTimersByTimeAsync(1000);
    const c = await p;
    expect(c?.notes).toHaveLength(1);
    expect(c?.notes[0]).toMatchObject({
      text: "Rappeler lundi.",
      authorName: "Testeur",
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
    const p = customersMock.getCustomer("cli-0003");
    await vi.advanceTimersByTimeAsync(1000);
    const note = (await p)!.notes[0]!;
    expect(note.authorName).toBe("Testeur");
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
