import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetDeliveriesMock } from "@/data/deliveries.mock";
import { resetOrdersMock } from "@/data/orders.mock";

/*
 * Session simulée : getCurrentUser() (Auth.js depuis A7) est remplacé par un
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

/* Même exception encadrée que test/app/commandes/actions.test.ts : server-only et next/cache neutralisés. */
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ getEnv: () => ({ DATA_SOURCE: "mock" }) }));
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

const { assignCourier } = await import("@/app/(dashboard)/livraisons/actions");
const { idleActionResult } = await import("@/lib/action-result");

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.append(k, v);
  return data;
}

async function run(fields: Record<string, string>) {
  const promise = assignCourier(idleActionResult, form(fields));
  await vi.advanceTimersByTimeAsync(2000);
  return promise;
}

beforeEach(() => {
  vi.useFakeTimers();
  session.role = "gestionnaire";
  resetOrdersMock();
  resetDeliveriesMock();
  revalidatePath.mockClear();
});
afterEach(() => vi.useRealTimers());

describe("assignCourier", () => {
  it("attribue un livreur libre sur le créneau", async () => {
    const r = await run({ orderId: "cmd-0002", courierId: "crs-0002" });
    expect(r).toEqual({
      status: "success",
      message: "Léa Fontaine livrera la commande FIG-260907-002.",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/livraisons");
  });

  it("refuse un livreur déjà pris sur le même créneau (côté serveur)", async () => {
    // crs-0001 livre cmd-0014 le 07 à 09:00 ; cmd-0002 est au même créneau
    const r = await run({ orderId: "cmd-0002", courierId: "crs-0001" });
    expect(r).toEqual({
      status: "error",
      message: "Ce livreur a déjà une livraison sur ce créneau.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("autorise la réattribution de la même commande au même livreur", async () => {
    const r = await run({ orderId: "cmd-0014", courierId: "crs-0001" });
    expect(r.status).toBe("success");
  });

  it("refuse une commande en attente, livrée ou annulée", async () => {
    expect(
      (await run({ orderId: "cmd-0001", courierId: "crs-0003" })).status,
    ).toBe("error");
    expect(
      (await run({ orderId: "cmd-0005", courierId: "crs-0003" })).status,
    ).toBe("error");
    expect(
      (await run({ orderId: "cmd-0006", courierId: "crs-0003" })).status,
    ).toBe("error");
  });

  it("refuse un livreur ou une commande inconnus, et une entrée invalide", async () => {
    expect(await run({ orderId: "cmd-0002", courierId: "crs-9999" })).toEqual({
      status: "error",
      message: "Ce livreur n'existe pas.",
    });
    expect(await run({ orderId: "cmd-9999", courierId: "crs-0001" })).toEqual({
      status: "error",
      message: "Cette commande n'existe plus.",
    });
    expect((await run({ orderId: "", courierId: "crs-0001" })).status).toBe(
      "error",
    );
  });
});
