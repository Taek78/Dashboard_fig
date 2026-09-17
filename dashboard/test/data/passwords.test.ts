import { describe, expect, it, vi } from "vitest";

/* Politique côté serveur : règles pures d'abord, puis fuites connues (simulées). */
const pwned = vi.hoisted(() => ({ answer: false as boolean | null, calls: 0 }));
vi.mock("server-only", () => ({}));
vi.mock("@/data/pwned-passwords", () => ({
  isPasswordPwned: async () => {
    pwned.calls += 1;
    return pwned.answer;
  },
}));

const { findPasswordProblem } = await import("@/data/passwords");
const context = { email: "zaki@fig.invalid", name: "Zaki" };

describe("findPasswordProblem", () => {
  it("un problème des règles pures est renvoyé sans appeler les fuites", async () => {
    pwned.calls = 0;
    expect(await findPasswordProblem("Motdepasse2026!", context)).toBe(
      "common",
    );
    expect(await findPasswordProblem("court", context)).toBe("too_short");
    expect(pwned.calls).toBe(0);
  });

  it("un mot de passe conforme mais fuité est refusé", async () => {
    pwned.answer = true;
    expect(
      await findPasswordProblem("Salade de tomates fraiches", context),
    ).toBe("breached");
  });

  it("conforme et inconnu des fuites : accepté ; fuites injoignables : accepté en le signalant", async () => {
    pwned.answer = false;
    expect(
      await findPasswordProblem("Salade de tomates fraiches", context),
    ).toBeNull();
    pwned.answer = null;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(
      await findPasswordProblem("Salade de tomates fraiches", context),
    ).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
