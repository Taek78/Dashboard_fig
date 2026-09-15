import { describe, expect, it } from "vitest";
import {
  CLIENT_TYPE_LABELS,
  CLIENT_TYPES,
  clientTypeOf,
} from "@/domain/customers/client-type";

describe("clientTypeOf", () => {
  it("particulier sans communauté, communauté sinon, chacun libellé", () => {
    expect(clientTypeOf(null)).toBe("particulier");
    expect(clientTypeOf({ id: "com-0002", name: "École Jules-Verne" })).toBe(
      "communaute",
    );
    for (const type of CLIENT_TYPES) {
      expect(CLIENT_TYPE_LABELS[type].length).toBeGreaterThan(0);
    }
  });
});
