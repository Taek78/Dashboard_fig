import { describe, expect, it } from "vitest";
import { assertMockSessionAllowed } from "@/domain/auth/guards";

describe("assertMockSessionAllowed", () => {
  it.each(["development", "test"])("autorise NODE_ENV=%s", (env) => {
    expect(() => assertMockSessionAllowed(env)).not.toThrow();
  });

  it.each(["production", "staging", "", undefined])(
    "refuse NODE_ENV=%s",
    (env) => {
      expect(() => assertMockSessionAllowed(env)).toThrow(
        /interdite hors development\/test/,
      );
    },
  );
});
