import { describe, expect, it } from "vitest";
import {
  changeOwnPasswordSchema,
  createUserSchema,
  deleteUserSchema,
  emailReminderSchema,
  invitationSchema,
  lockAccountSchema,
  loginSchema,
  recoveryRequestSchema,
  recoveryVerifySchema,
  resetPasswordSchema,
  sendPasswordLinkSchema,
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

describe("createUserSchema / deleteUserSchema", () => {
  const valid = {
    email: "Nour@FIG.invalid",
    firstName: " Nour ",
    lastName: " Benali ",
    role: "gestionnaire",
  };
  it("accepte une entrée valide et normalise ; plus de mot de passe (invitation)", () => {
    expect(createUserSchema.parse(valid)).toEqual({
      email: "nour@fig.invalid",
      firstName: "Nour",
      lastName: "Benali",
      role: "gestionnaire",
    });
    expect(
      createUserSchema.parse({ ...valid, password: "ignoré" }),
    ).not.toHaveProperty("password");
  });
  it("refuse un rôle inconnu, un prénom vide, un nom vide ou d'une lettre", () => {
    expect(createUserSchema.safeParse({ ...valid, role: "dieu" }).success).toBe(
      false,
    );
    expect(
      createUserSchema.safeParse({ ...valid, firstName: "  " }).success,
    ).toBe(false);
    expect(
      createUserSchema.safeParse({ ...valid, lastName: "  " }).success,
    ).toBe(false);
    expect(
      createUserSchema.safeParse({ ...valid, lastName: "N" }).success,
    ).toBe(false);
  });
  it("deleteUserSchema exige le mot SUPPRIMER, en toute casse", () => {
    expect(
      deleteUserSchema.parse({ userId: " usr-1 ", confirm: " supprimer " }),
    ).toEqual({ userId: "usr-1", confirm: "SUPPRIMER" });
    expect(
      deleteUserSchema.safeParse({ userId: "usr-1", confirm: "oui" }).success,
    ).toBe(false);
    expect(deleteUserSchema.safeParse({ userId: "usr-1" }).success).toBe(false);
  });
});

describe("récupération, invitation, rappel, verrouillage", () => {
  const token = "a".repeat(43);

  it("recoveryRequestSchema normalise l'e-mail", () => {
    expect(recoveryRequestSchema.parse({ email: "A@B.Invalid" })).toEqual({
      email: "a@b.invalid",
    });
  });

  it("recoveryVerifySchema exige six chiffres (espaces tolérés) et la confirmation", () => {
    const valid = {
      email: "a@b.invalid",
      code: " 042 917 ",
      newPassword: "Une-phrase-de-passe",
      confirmPassword: "Une-phrase-de-passe",
    };
    expect(recoveryVerifySchema.parse(valid).code).toBe("042917");
    expect(
      recoveryVerifySchema.safeParse({ ...valid, code: "04291" }).success,
    ).toBe(false);
    expect(
      recoveryVerifySchema.safeParse({ ...valid, code: "04291a" }).success,
    ).toBe(false);
    expect(
      recoveryVerifySchema.safeParse({ ...valid, confirmPassword: "autre" })
        .success,
    ).toBe(false);
    expect(
      recoveryVerifySchema.safeParse({
        ...valid,
        newPassword: "court",
        confirmPassword: "court",
      }).success,
    ).toBe(false);
  });

  it("emailReminderSchema ne prend que le nom, borné", () => {
    expect(emailReminderSchema.parse({ lastName: " Affane " })).toEqual({
      lastName: "Affane",
    });
    expect(emailReminderSchema.safeParse({ lastName: "A" }).success).toBe(
      false,
    );
    expect(emailReminderSchema.safeParse({ name: "Zaki Affane" }).success).toBe(
      false,
    );
  });

  it("invitationSchema et lockAccountSchema bornent le jeton", () => {
    expect(
      invitationSchema.safeParse({
        token,
        newPassword: "Une-phrase-de-passe",
        confirmPassword: "Une-phrase-de-passe",
      }).success,
    ).toBe(true);
    expect(
      invitationSchema.safeParse({
        token: "court",
        newPassword: "Une-phrase-de-passe",
        confirmPassword: "Une-phrase-de-passe",
      }).success,
    ).toBe(false);
    expect(lockAccountSchema.parse({ token: ` ${token} ` })).toEqual({ token });
    expect(
      lockAccountSchema.safeParse({ token: "x".repeat(201) }).success,
    ).toBe(false);
    expect(sendPasswordLinkSchema.parse({ userId: " usr-1 " })).toEqual({
      userId: "usr-1",
    });
  });
});

describe("updateUserSchema / setUserActiveSchema / resetPasswordSchema", () => {
  it("valident leurs champs", () => {
    expect(
      updateUserSchema.parse({
        userId: "usr-1",
        firstName: "Nour",
        lastName: "Benali",
        role: "lecture",
      }),
    ).toEqual({
      userId: "usr-1",
      firstName: "Nour",
      lastName: "Benali",
      role: "lecture",
    });
    expect(
      updateUserSchema.safeParse({
        userId: "usr-1",
        firstName: "Nour",
        lastName: "B",
        role: "lecture",
      }).success,
    ).toBe(false);
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
