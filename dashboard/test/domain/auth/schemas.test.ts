import { describe, expect, it } from "vitest";
import { loginSchema } from "@/domain/auth/schemas";

describe("loginSchema", () => {
  it("accepte un e-mail (mis en minuscules) et un mot de passe", () => {
    const r = loginSchema.safeParse({
      email: "Admin@Example.invalid",
      password: "x",
    });
    expect(r.success && r.data.email).toBe("admin@example.invalid");
  });

  it("refuse un e-mail invalide, un mot de passe vide ou absent", () => {
    expect(
      loginSchema.safeParse({ email: "admin", password: "x" }).success,
    ).toBe(false);
    expect(
      loginSchema.safeParse({ email: "a@b.co", password: "" }).success,
    ).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.co" }).success).toBe(false);
  });
});
