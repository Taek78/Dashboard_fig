import { describe, expect, it } from "vitest";
import { addNewItems } from "@/lib/alert-events";

describe("addNewItems (sections illuminées du menu)", () => {
  it("additionne par section, ignore les zéros", () => {
    expect(addNewItems({}, { "/commandes": 2, "/messages": 0 })).toEqual({
      "/commandes": 2,
    });
    expect(
      addNewItems({ "/commandes": 2 }, { "/commandes": 1, "/messages": 1 }),
    ).toEqual({ "/commandes": 3, "/messages": 1 });
  });
});
