import { describe, expect, it } from "vitest";
import {
  CLIENT_TYPE_LABELS,
  CLIENT_TYPES,
  COMMUNITY_MEMBER_LABEL,
} from "@/domain/customers/client-type";

describe("types de client", () => {
  it("une personne est un particulier, un groupe une communauté, chacun libellé", () => {
    expect(CLIENT_TYPES).toEqual(["particulier", "communaute"]);
    expect(CLIENT_TYPE_LABELS).toEqual({
      particulier: "Particulier",
      communaute: "Communauté",
    });
    expect(COMMUNITY_MEMBER_LABEL).toBe("Communauté");
  });
});
