import { describe, expect, it } from "vitest";
import {
  ANONYMIZE_CONFIRM_WORD,
  ANONYMIZED_CUSTOMER_NAME,
  anonymizedCustomerFields,
  isAnonymized,
} from "@/domain/privacy/anonymization";
import { anonymizeCustomerSchema } from "@/domain/privacy/schemas";

describe("anonymizedCustomerFields", () => {
  it("remplace tout ce qui identifie la personne", () => {
    expect(anonymizedCustomerFields("cli-0007")).toEqual({
      fullName: ANONYMIZED_CUSTOMER_NAME,
      email: "anonyme-cli-0007@anonyme.invalid",
      phone: "",
      city: "",
      postalCode: "",
    });
  });

  it("garde des e-mails distincts (index unique de la base)", () => {
    expect(anonymizedCustomerFields("cli-0001").email).not.toBe(
      anonymizedCustomerFields("cli-0002").email,
    );
  });

  it("isAnonymized lit la date d'anonymisation", () => {
    expect(isAnonymized({ anonymizedAt: null })).toBe(false);
    expect(isAnonymized({ anonymizedAt: "2026-09-15T10:00:00.000Z" })).toBe(
      true,
    );
  });
});

describe("anonymizeCustomerSchema", () => {
  it("exige le mot ANONYMISER, espaces et casse tolérés", () => {
    expect(ANONYMIZE_CONFIRM_WORD).toBe("ANONYMISER");
    expect(
      anonymizeCustomerSchema.safeParse({
        customerId: "cli-0001",
        confirm: " anonymiser ",
      }).success,
    ).toBe(true);
  });

  it("refuse un autre mot, un mot absent ou un client absent", () => {
    for (const input of [
      { customerId: "cli-0001", confirm: "SUPPRIMER" },
      { customerId: "cli-0001", confirm: "" },
      { customerId: "cli-0001" },
      { confirm: "ANONYMISER" },
      { customerId: "x".repeat(65), confirm: "ANONYMISER" },
    ]) {
      expect(anonymizeCustomerSchema.safeParse(input).success).toBe(false);
    }
  });
});
