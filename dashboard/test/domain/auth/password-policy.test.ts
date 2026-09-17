import { describe, expect, it } from "vitest";
import {
  characterClasses,
  firstPasswordProblem,
  PASSWORD_PROBLEM_MESSAGES,
  passwordProblems,
  passwordStrength,
} from "@/domain/auth/password-policy";

/*
 * Politique de mots de passe (règles pures) : longueur d'abord, phrase de
 * passe libre dès 16 caractères, mot court varié, ni mot courant, ni nom ou
 * e-mail du compte, ni motif répété, ni suite de clavier.
 */
const zaki = { name: "Zaki Affane", email: "zaki.affane@fig.invalid" };

describe("passwordProblems", () => {
  it("accepte une phrase de passe de quatre mots sans autre contrainte", () => {
    expect(passwordProblems("salade de tomates fraiches", zaki)).toEqual([]);
    expect(passwordProblems("Quatre mots avec des espaces", zaki)).toEqual([]);
  });

  it("accepte un mot court varié, refuse un mot court peu varié", () => {
    expect(passwordProblems("Rutabaga-2026!", zaki)).toEqual([]);
    expect(passwordProblems("vergerdumatin", zaki)).toEqual(["weak_mix"]);
    expect(passwordProblems("VERGERDUMATIN1", zaki)).toEqual(["weak_mix"]);
  });

  it("refuse trop court, trop long", () => {
    expect(passwordProblems("Court-1!", zaki)).toContain("too_short");
    expect(passwordProblems("a".repeat(201) + "B1!", zaki)).toContain(
      "too_long",
    );
    // Trop court n'ajoute pas le reproche de composition.
    expect(passwordProblems("courtcourt", zaki)).toEqual(["too_short"]);
  });

  it("refuse les mots courants, même avec chiffres et signes en fin ou accents", () => {
    for (const weak of [
      "Motdepasse2026!",
      "motdepasse123456",
      "Marseille2026!!",
      "azertyuiop123",
      "Password2026!",
      "Mot-de-passe-2026",
      "Chocolat2024!!",
    ]) {
      expect(passwordProblems(weak, zaki), weak).toContain("common");
    }
  });

  it("refuse le nom ou l'e-mail de la personne, sans casse ni accent", () => {
    expect(passwordProblems("Zaki-Affane-2026!", zaki)).toContain("personal");
    expect(passwordProblems("mon prenom est zaki oui", zaki)).toContain(
      "personal",
    );
    expect(passwordProblems("AFFANE le grand chef", zaki)).toContain(
      "personal",
    );
    expect(
      passwordProblems("Élise-2026-Secure!", {
        name: "Elise Durand",
        email: "e.durand@fig.invalid",
      }),
    ).toContain("personal");
    // Sans contexte, aucune règle « personnel ».
    expect(passwordProblems("Zaki-Affane-2026!")).toEqual([]);
  });

  it("refuse un motif répété et une suite de clavier ou d'alphabet", () => {
    expect(passwordProblems("abcabcabcabc", zaki)).toContain("repetitive");
    expect(passwordProblems("Ab1!Ab1!Ab1!Ab1!", zaki)).toContain("repetitive");
    expect(passwordProblems("Azertyuiop-2026!", zaki)).toContain("sequence");
    expect(passwordProblems("abcdefghijkl-2026!", zaki)).toContain("sequence");
    expect(passwordProblems("mon code 0123456789 secret", zaki)).toContain(
      "sequence",
    );
    expect(passwordProblems("poiuytreza-Secret-9", zaki)).toContain("sequence");
    expect(passwordProblems("Une phrase sans suite du tout", zaki)).toEqual([]);
  });
});

describe("firstPasswordProblem / messages", () => {
  it("renvoie le premier problème dans l'ordre d'affichage, null si accepté", () => {
    expect(firstPasswordProblem("court", zaki)).toBe("too_short");
    expect(firstPasswordProblem("Motdepasse2026!", zaki)).toBe("common");
    expect(firstPasswordProblem("Une phrase tranquille", zaki)).toBeNull();
  });

  it("chaque problème a un message français, dont celui des fuites connues", () => {
    for (const message of Object.values(PASSWORD_PROBLEM_MESSAGES)) {
      expect(message.length).toBeGreaterThan(10);
    }
    expect(PASSWORD_PROBLEM_MESSAGES.breached).toMatch(/fuites/);
  });
});

describe("characterClasses / passwordStrength", () => {
  it("compte les types de caractères", () => {
    expect(characterClasses("abc")).toBe(1);
    expect(characterClasses("abcABC")).toBe(2);
    expect(characterClasses("abcABC123")).toBe(3);
    expect(characterClasses("abcABC123!")).toBe(4);
    expect(characterClasses("été 2026")).toBe(3);
  });

  it("gradue : trop court, refusé, correct, fort, très fort", () => {
    expect(passwordStrength("court", zaki)).toMatchObject({
      level: 0,
      label: "Trop court",
      problem: "too_short",
    });
    expect(passwordStrength("Motdepasse2026!", zaki)).toMatchObject({
      level: 1,
      label: "Refusé",
      problem: "common",
    });
    expect(passwordStrength("Rutabaga-2026!", zaki)).toMatchObject({
      level: 2,
      label: "Correct",
      problem: null,
    });
    expect(passwordStrength("salade de tomates", zaki)).toMatchObject({
      level: 3,
      label: "Fort",
    });
    expect(
      passwordStrength("Salade de tomates au basilic 2026", zaki),
    ).toMatchObject({ level: 4, label: "Très fort" });
    expect(
      passwordStrength("une longue phrase de passe sans chiffre ni signe", zaki)
        .level,
    ).toBe(4);
  });
});
