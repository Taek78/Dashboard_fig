import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetStaffMock, staffMock } from "@/data/staff.mock";

/*
 * Server Actions du personnel, de bout en bout sur le mock : session simulée
 * (rôle pilotable), server-only et env neutralisés, revalidatePath espionné,
 * journal neutralisé, redirect() simulé par une exception.
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
vi.mock("@/data/security-log", () => ({ logSecurity: vi.fn() }));
const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
);
vi.mock("next/navigation", () => ({ redirect }));

const { addStaffMember, removeStaffMember, saveStaffMember } =
  await import("@/app/(dashboard)/personnel/actions");
const { idleActionResult } = await import("@/lib/action-result");

function form(fields: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    for (const value of Array.isArray(v) ? v : [v]) data.append(k, value);
  }
  return data;
}

const base = {
  kind: "livreur",
  firstName: "Nour",
  lastName: "Sassi",
  email: "nour.sassi@fig-demo.invalid",
  phone: "06 39 98 90 50",
  shift: "soir",
  availability: "disponible",
  workDays: ["jeu", "ven", "sam"],
  startedAt: "2026-09-14",
  notes: "Scooter",
  active: "on",
};

type Outcome = {
  result?: Awaited<ReturnType<typeof saveStaffMember>>;
  redirectedTo?: string;
};

async function run(
  action: typeof saveStaffMember,
  fields: Record<string, string | string[]>,
): Promise<Outcome> {
  const promise = action(idleActionResult, form(fields)).then(
    (result): Outcome => ({ result }),
    (error: Error): Outcome => ({
      redirectedTo: error.message.replace("NEXT_REDIRECT:", ""),
    }),
  );
  await vi.advanceTimersByTimeAsync(2000);
  return promise;
}

async function read(id: string) {
  const p = staffMock.getStaff(id);
  await vi.advanceTimersByTimeAsync(1000);
  return p;
}

beforeEach(() => {
  vi.useFakeTimers();
  session.role = "gestionnaire";
  resetStaffMock();
  revalidatePath.mockClear();
});
afterEach(() => vi.useRealTimers());

describe("addStaffMember", () => {
  it("crée la personne (jours en plusieurs valeurs) et redirige vers sa fiche", async () => {
    const { redirectedTo } = await run(addStaffMember, base);
    expect(redirectedTo).toBe("/personnel/stf-m-1?cree=1");
    expect(await read("stf-m-1")).toMatchObject({
      firstName: "Nour",
      workDays: ["jeu", "ven", "sam"],
      notes: "Scooter",
      active: true,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("refuse le rôle lecture, une saisie invalide et un e-mail déjà pris", async () => {
    session.role = "lecture";
    expect((await run(addStaffMember, base)).result?.status).toBe("error");
    session.role = "admin";
    expect(
      (await run(addStaffMember, { ...base, email: "x" })).result,
    ).toMatchObject({ status: "error" });
    const taken = await run(addStaffMember, {
      ...base,
      email: "malik.dembele@fig-demo.invalid",
    });
    expect(taken.result).toEqual({
      status: "error",
      message: "Une personne de l'équipe a déjà cet e-mail.",
    });
    expect(await read("stf-m-1")).toBeNull();
  });
});

describe("saveStaffMember", () => {
  it("enregistre la fiche et le message porte le nom", async () => {
    const { result } = await run(saveStaffMember, {
      ...base,
      staffId: "stf-0002",
      availability: "conge",
    });
    expect(result).toEqual({
      status: "success",
      message: "Fiche de Nour Sassi enregistrée.",
    });
    expect(await read("stf-0002")).toMatchObject({
      availability: "conge",
      createdAt: "2025-02-10T09:00:00.000Z",
    });
  });

  it("signale une personne inconnue", async () => {
    const { result } = await run(saveStaffMember, {
      ...base,
      staffId: "stf-9999",
    });
    expect(result).toEqual({
      status: "error",
      message: "Cette personne n'est plus dans l'équipe.",
    });
  });
});

describe("removeStaffMember", () => {
  it("exige SUPPRIMER, supprime puis redirige", async () => {
    const refused = await run(removeStaffMember, {
      staffId: "stf-0004",
      confirm: "oui",
    });
    expect(refused.result?.status).toBe("error");
    expect(await read("stf-0004")).not.toBeNull();

    const { redirectedTo } = await run(removeStaffMember, {
      staffId: "stf-0004",
      confirm: "SUPPRIMER",
    });
    expect(redirectedTo).toBe("/personnel?supprime=1");
    expect(await read("stf-0004")).toBeNull();
  });
});
