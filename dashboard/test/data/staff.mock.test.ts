import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resetStaffMock,
  STAFF_MOCK_LATENCY_MS,
  staffMock,
} from "@/data/staff.mock";
import {
  COMMUNITIES_MOCK_LATENCY_MS,
  communitiesMock,
} from "@/data/communities.mock";
import { staffFixtures } from "@/domain/staff/fixtures";
import type { StaffInput } from "@/domain/staff/types";

beforeEach(() => {
  vi.useFakeTimers();
  resetStaffMock();
});
afterEach(() => vi.useRealTimers());

async function settle<T>(promise: Promise<T>, ms = STAFF_MOCK_LATENCY_MS) {
  await vi.advanceTimersByTimeAsync(ms);
  return promise;
}

const input: StaffInput = {
  kind: "preparateur",
  firstName: "Nour",
  lastName: "Sassi",
  email: "nour.sassi@fig-demo.invalid",
  phone: "06 39 98 90 50",
  shift: "matin",
  availability: "disponible",
  workDays: ["lun", "mar"],
  startedAt: "2026-09-14",
  notes: null,
  active: true,
};

describe("staffMock", () => {
  it("listStaff trie et filtre par métier, en copies", async () => {
    const all = await settle(staffMock.listStaff());
    expect(all).toHaveLength(staffFixtures.length);
    expect(all.at(-1)?.active).toBe(false);
    const drivers = await settle(staffMock.listStaff("livreur"));
    expect(drivers.every((m) => m.kind === "livreur")).toBe(true);
    drivers[0]!.firstName = "Modifié";
    const again = await settle(staffMock.getStaff(drivers[0]!.id));
    expect(again?.firstName).not.toBe("Modifié");
  });

  it("createStaff attribue un id et refuse un e-mail déjà pris (sans casse)", async () => {
    const created = await settle(staffMock.createStaff(input));
    expect(created).toMatchObject({ id: "stf-m-1", firstName: "Nour" });
    expect(
      await settle(
        staffMock.createStaff({
          ...input,
          email: "MALIK.DEMBELE@fig-demo.invalid",
        }),
      ),
    ).toBe("email_taken");
  });

  it("updateStaff remplace la fiche, garde id et createdAt, détecte le doublon d'e-mail", async () => {
    const updated = await settle(
      staffMock.updateStaff("stf-0005", { ...input, kind: "preparateur" }),
    );
    expect(updated).toMatchObject({
      id: "stf-0005",
      firstName: "Nour",
      createdAt: staffFixtures[4]!.createdAt,
    });
    expect(
      await settle(
        staffMock.updateStaff("stf-0005", {
          ...input,
          email: "sophie.renard@fig-demo.invalid",
        }),
      ),
    ).toBe("email_taken");
    expect(await settle(staffMock.updateStaff("stf-9999", input))).toBeNull();
  });

  it("deleteStaff supprime, resetStaffMock restaure", async () => {
    expect(await settle(staffMock.deleteStaff("stf-0004"))).toBe(true);
    expect(await settle(staffMock.getStaff("stf-0004"))).toBeNull();
    expect(await settle(staffMock.deleteStaff("stf-0004"))).toBe(false);
    resetStaffMock();
    expect(await settle(staffMock.getStaff("stf-0004"))).not.toBeNull();
  });
});

describe("communitiesMock", () => {
  it("liste triée et lecture par id, en copies", async () => {
    const list = await settle(
      communitiesMock.listCommunities(),
      COMMUNITIES_MOCK_LATENCY_MS,
    );
    expect(list.map((c) => c.id)).toEqual(["com-0003", "com-0001", "com-0002"]);
    const one = await settle(
      communitiesMock.getCommunity("com-0001"),
      COMMUNITIES_MOCK_LATENCY_MS,
    );
    expect(one?.name).toBe("Crèche Les Lucioles");
    one!.name = "x";
    const again = await settle(
      communitiesMock.getCommunity("com-0001"),
      COMMUNITIES_MOCK_LATENCY_MS,
    );
    expect(again?.name).toBe("Crèche Les Lucioles");
    expect(
      await settle(
        communitiesMock.getCommunity("com-9999"),
        COMMUNITIES_MOCK_LATENCY_MS,
      ),
    ).toBeNull();
  });
});
