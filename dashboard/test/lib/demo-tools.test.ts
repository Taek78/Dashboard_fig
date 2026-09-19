import { describe, expect, it } from "vitest";
import { canUseDemoTools, demoToolsEnabled } from "@/lib/demo-tools";

describe("outils de démonstration (à retirer avant la livraison)", () => {
  it("jamais en production", () => {
    expect(demoToolsEnabled("production")).toBe(false);
    expect(demoToolsEnabled("development")).toBe(true);
    expect(demoToolsEnabled("test")).toBe(true);
    expect(canUseDemoTools("admin", "production")).toBe(false);
  });

  it("admin et gestionnaire seulement", () => {
    expect(canUseDemoTools("admin", "development")).toBe(true);
    expect(canUseDemoTools("gestionnaire", "development")).toBe(true);
    expect(canUseDemoTools("lecture", "development")).toBe(false);
    expect(canUseDemoTools("livreur", "development")).toBe(false);
  });
});
