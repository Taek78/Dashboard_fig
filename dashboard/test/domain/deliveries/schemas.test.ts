import { describe, expect, it } from "vitest";
import {
  assignCourierSchema,
  parseTourDate,
} from "@/domain/deliveries/schemas";

describe("assignCourierSchema", () => {
  it("accepte orderId et courierId non vides, trimés", () => {
    const r = assignCourierSchema.safeParse({
      orderId: " cmd-0002 ",
      courierId: "crs-0001",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.orderId).toBe("cmd-0002");
  });

  it("refuse un champ vide, manquant ou trop long", () => {
    expect(
      assignCourierSchema.safeParse({ orderId: "", courierId: "x" }).success,
    ).toBe(false);
    expect(assignCourierSchema.safeParse({ orderId: "cmd-0002" }).success).toBe(
      false,
    );
    expect(
      assignCourierSchema.safeParse({
        orderId: "cmd-0002",
        courierId: "x".repeat(65),
      }).success,
    ).toBe(false);
  });
});

describe("parseTourDate", () => {
  it("renvoie la date valide, undefined sinon", () => {
    expect(parseTourDate({ date: "2026-09-07" })).toBe("2026-09-07");
    expect(parseTourDate({})).toBeUndefined();
    expect(parseTourDate({ date: "07/09/2026" })).toBeUndefined();
    expect(
      parseTourDate({ date: ["2026-09-07", "2026-09-08"] }),
    ).toBeUndefined();
  });
});
