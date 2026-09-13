import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const env = vi.hoisted(() => ({ DATA_SOURCE: "mock" as "db" | "mock" }));
vi.mock("@/lib/env", () => ({ getEnv: () => env }));

const { selectSource } = await import("@/data/select-source");

describe("selectSource", () => {
  it("renvoie le mock en mode mock, même si une version db existe", () => {
    env.DATA_SOURCE = "mock";
    expect(selectSource("x", "mock", "db")).toBe("mock");
    expect(selectSource("x", "mock", null)).toBe("mock");
  });

  it("renvoie la version db en mode db, et lève si elle n'existe pas encore", () => {
    env.DATA_SOURCE = "db";
    expect(selectSource("x", "mock", "db")).toBe("db");
    expect(() => selectSource("commandes", "mock", null)).toThrow(/commandes/);
  });
});
