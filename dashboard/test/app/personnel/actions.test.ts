import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Server Actions du personnel, de bout en bout sur la base de test : session
 * simulée (rôle pilotable), server-only neutralisé, revalidatePath espionné,
 * journal neutralisé, redirect() simulé par une exception. Chaque test dans une
 * transaction annulée.
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
vi.mock("@/data/security-log", () => ({ logSecurity: vi.fn() }));
const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
);
vi.mock("next/navigation", () => ({ redirect }));

const { isolateEachTest } = await import("../../support/test-database");
isolateEachTest();

const { addStaffMember, removeStaffMember, saveStaffMember } =
  await import("@/app/(dashboard)/personnel/actions");
const { getStaff } = await import("@/data/staff");
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
};

type Outcome = {
  result?: Awaited<ReturnType<typeof saveStaffMember>>;
  redirectedTo?: string;
};

function run(
  action: typeof saveStaffMember,
  fields: Record<string, string | string[]>,
): Promise<Outcome> {
  return action(idleActionResult, form(fields)).then(
    (result): Outcome => ({ result }),
    (error: Error): Outcome => ({
      redirectedTo: error.message.replace("NEXT_REDIRECT:", ""),
    }),
  );
}

beforeEach(() => {
  session.role = "gestionnaire";
  revalidatePath.mockClear();
});

describe("addStaffMember", () => {
  it("crée la personne (jours en plusieurs valeurs) et redirige vers sa fiche", async () => {
    const { redirectedTo } = await run(addStaffMember, base);
    const id = redirectedTo?.match(/^\/personnel\/([^?]+)\?cree=1$/)?.[1];
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await getStaff(id!)).toMatchObject({
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
    expect(
      (
        await run(addStaffMember, {
          ...base,
          email: "malik.dembele@fig-demo.invalid",
        })
      ).result,
    ).toEqual({
      status: "error",
      message: "Une personne de l'équipe a déjà cet e-mail.",
    });
  });
});

describe("saveStaffMember", () => {
  it("enregistre la fiche et le message porte le nom", async () => {
    expect(
      (
        await run(saveStaffMember, {
          ...base,
          staffId: "stf-0002",
          availability: "conge",
        })
      ).result,
    ).toEqual({
      status: "success",
      message: "Fiche de Nour Sassi enregistrée.",
    });
    expect(await getStaff("stf-0002")).toMatchObject({
      availability: "conge",
      createdAt: "2025-02-10T09:00:00.000Z",
    });
  });

  it("signale une personne inconnue", async () => {
    expect(
      (await run(saveStaffMember, { ...base, staffId: "stf-9999" })).result,
    ).toEqual({
      status: "error",
      message: "Cette personne n'est plus dans l'équipe.",
    });
  });
});

describe("removeStaffMember", () => {
  it("exige la confirmation de la fenêtre, supprime puis redirige", async () => {
    // Ni sans confirmation, ni avec l'ancien mot à taper.
    for (const confirm of [undefined, "SUPPRIMER"]) {
      expect(
        (
          await run(removeStaffMember, {
            staffId: "stf-0004",
            ...(confirm === undefined ? {} : { confirm }),
          })
        ).result?.status,
      ).toBe("error");
    }
    expect(await getStaff("stf-0004")).not.toBeNull();

    const { redirectedTo } = await run(removeStaffMember, {
      staffId: "stf-0004",
      confirm: "oui",
    });
    expect(redirectedTo).toBe("/personnel?supprime=1");
    expect(await getStaff("stf-0004")).toBeNull();
  });
});
