import { describe, expect, it } from "vitest";
import {
  changeOwnPasswordSchema,
  createUserSchema,
  loginSchema,
  resetPasswordSchema,
  setUserActiveSchema,
  updateUserSchema,
} from "@/domain/auth/schemas";

describe("loginSchema", () => {
  it("normalise l'e-mail en minuscules et exige un mot de passe", () => {
    expect(loginSchema.parse({ email: "A@B.Invalid", password: "x" })).toEqual({
      email: "a@b.invalid",
      password: "x",
    });
    expect(
      loginSchema.safeParse({ email: "pas-un-mail", password: "x" }).success,
    ).toBe(false);
  });
});

describe("createUserSchema", () => {
  const valid = {
    email: "Nour@FIG.invalid",
    name: " Nour ",
    role: "gestionnaire",
    password: "Un-mot-de-passe-long",
  };
  it("accepte une entrée valide et normalise", () => {
    expect(createUserSchema.parse(valid)).toEqual({
      email: "nour@fig.invalid",
      name: "Nour",
      role: "gestionnaire",
      password: "Un-mot-de-passe-long",
    });
  });
  it("refuse un mot de passe court, un rôle inconnu, un nom vide", () => {
    expect(
      createUserSchema.safeParse({ ...valid, password: "court" }).success,
    ).toBe(false);
    expect(createUserSchema.safeParse({ ...valid, role: "dieu" }).success).toBe(
      false,
    );
    expect(createUserSchema.safeParse({ ...valid, name: "  " }).success).toBe(
      false,
    );
  });
});

describe("updateUserSchema / setUserActiveSchema / resetPasswordSchema", () => {
  it("valident leurs champs", () => {
    expect(
      updateUserSchema.parse({ userId: "usr-1", name: "N", role: "lecture" }),
    ).toEqual({ userId: "usr-1", name: "N", role: "lecture" });
    expect(
      setUserActiveSchema.parse({ userId: "usr-1", active: "0" }).active,
    ).toBe(false);
    expect(
      setUserActiveSchema.safeParse({ userId: "usr-1", active: "non" }).success,
    ).toBe(false);
    expect(
      resetPasswordSchema.safeParse({ userId: "usr-1", password: "trop-court" })
        .success,
    ).toBe(false);
    expect(
      resetPasswordSchema.safeParse({
        userId: "usr-1",
        password: "assez-long-oui",
      }).success,
    ).toBe(true);
  });
});

describe("changeOwnPasswordSchema", () => {
  const valid = {
    currentPassword: "Ancien-mot-de-passe",
    newPassword: "Nouveau-mot-de-passe",
    confirmPassword: "Nouveau-mot-de-passe",
  };
  it("exige la confirmation identique et un nouveau différent de l'actuel", () => {
    expect(changeOwnPasswordSchema.safeParse(valid).success).toBe(true);
    expect(
      changeOwnPasswordSchema.safeParse({ ...valid, confirmPassword: "autre" })
        .success,
    ).toBe(false);
    expect(
      changeOwnPasswordSchema.safeParse({
        ...valid,
        newPassword: valid.currentPassword,
        confirmPassword: valid.currentPassword,
      }).success,
    ).toBe(false);
    expect(
      changeOwnPasswordSchema.safeParse({
        ...valid,
        newPassword: "court",
        confirmPassword: "court",
      }).success,
    ).toBe(false);
  });
});
