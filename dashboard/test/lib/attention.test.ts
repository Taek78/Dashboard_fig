import { describe, expect, it } from "vitest";
import { titleWithCount } from "@/lib/attention";

describe("titleWithCount (titre de l'onglet vu de la barre des tâches)", () => {
  it("préfixe le compte, le remplace, le retire à 0, plafonne à 99+", () => {
    expect(titleWithCount("Tableau de bord · FIG", 3)).toBe(
      "(3) Tableau de bord · FIG",
    );
    expect(titleWithCount("(3) Tableau de bord · FIG", 5)).toBe(
      "(5) Tableau de bord · FIG",
    );
    expect(titleWithCount("(5) Tableau de bord · FIG", 0)).toBe(
      "Tableau de bord · FIG",
    );
    expect(titleWithCount("Commandes", 120)).toBe("(99+) Commandes");
    expect(titleWithCount("(99+) Commandes", 0)).toBe("Commandes");
    // Une parenthèse qui fait partie du titre n'est pas un compte.
    expect(titleWithCount("(FIG) Commandes", 0)).toBe("(FIG) Commandes");
  });
});
