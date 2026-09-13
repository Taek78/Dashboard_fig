import { describe, expect, it } from "vitest";
import {
  dummyPasswordHash,
  hashPassword,
  verifyPassword,
} from "@/lib/password";

describe("hashPassword / verifyPassword", () => {
  it("vérifie le bon mot de passe et refuse un autre", async () => {
    const stored = await hashPassword("Demo-FIG-2026-local");
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("Demo-FIG-2026-local", stored)).toBe(true);
    expect(await verifyPassword("Demo-FIG-2026-locaL", stored)).toBe(false);
    expect(await verifyPassword("", stored)).toBe(false);
  });

  it("sale chaque hachage : deux hachages du même mot de passe diffèrent", async () => {
    const a = await hashPassword("même mot de passe");
    const b = await hashPassword("même mot de passe");
    expect(a).not.toBe(b);
    expect(a).not.toContain("même mot de passe");
  });

  it("refuse un format stocké inconnu sans lever", async () => {
    expect(await verifyPassword("x", "bcrypt$abc$def")).toBe(false);
    expect(await verifyPassword("x", "")).toBe(false);
  });
});

describe("dummyPasswordHash", () => {
  it("est un hachage scrypt stable par processus qu'aucun mot de passe ne vérifie", async () => {
    const a = await dummyPasswordHash();
    expect(a.startsWith("scrypt$")).toBe(true);
    expect(await dummyPasswordHash()).toBe(a);
    expect(await verifyPassword("", a)).toBe(false);
    expect(await verifyPassword("Demo-FIG-2026-local", a)).toBe(false);
  });
});
