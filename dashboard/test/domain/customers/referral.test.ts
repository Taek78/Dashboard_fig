import { describe, expect, it } from "vitest";
import {
  CONSENT_KEYS,
  CONSENT_LABELS,
  grantedConsentCount,
  NO_CONSENTS,
} from "@/domain/customers/consents";
import {
  isReferralCode,
  REFERRAL_CODE_PATTERN,
  referralCodeFor,
  signupDay,
  signupStats,
} from "@/domain/customers/referral";

describe("codes de parrainage", () => {
  it("Nom#0000 : le nom de famille, un dièse, quatre chiffres", () => {
    expect(isReferralCode("Benali#0001")).toBe(true);
    expect(isReferralCode("Da Silva#0010")).toBe(true);
    expect(isReferralCode("Benali#001")).toBe(false);
    expect(isReferralCode("Benali#00012")).toBe(false);
    expect(isReferralCode("#0001")).toBe(false);
    expect(isReferralCode("Benali0001")).toBe(false);
    expect(isReferralCode("Ben#ali#0001")).toBe(false);
    expect(REFERRAL_CODE_PATTERN.source).toBe("^[^#]+#\\d{4}$");
  });

  it("referralCodeFor prend tout ce qui suit le prénom", () => {
    expect(referralCodeFor("Amel Benali", 1)).toBe("Benali#0001");
    expect(referralCodeFor("Chloé Da Silva", 10)).toBe("Da Silva#0010");
    expect(referralCodeFor("Madonna", 7)).toBe("Madonna#0007");
    expect(isReferralCode(referralCodeFor("  Noah  Okafor ", 1042))).toBe(true);
  });
});

describe("signupStats (métrique « Parrainages »)", () => {
  const amel = { id: "cli-0001", fullName: "Amel Benali" };
  const customers = [
    { createdAt: "2026-09-01T08:00:00.000Z", referredBy: null },
    { createdAt: "2026-09-03T23:30:00.000Z", referredBy: amel },
    { createdAt: "2026-09-08T10:00:00.000Z", referredBy: amel },
    { createdAt: "2026-09-08T10:00:00.000Z", referredBy: null },
    { createdAt: "2026-10-01T10:00:00.000Z", referredBy: amel },
  ];

  it("le jour d'inscription est le jour UTC de l'instant", () => {
    expect(signupDay({ createdAt: "2026-09-03T23:30:00.000Z" })).toBe(
      "2026-09-03",
    );
  });

  it("compte les inscrits de la période et, parmi eux, les parrainés", () => {
    expect(
      signupStats(customers, { from: "2026-09-01", to: "2026-09-08" }),
    ).toEqual({ signups: 4, referred: 2 });
    expect(
      signupStats(customers, { from: "2026-09-03", to: "2026-09-03" }),
    ).toEqual({ signups: 1, referred: 1 });
    expect(
      signupStats(customers, { from: "2026-11-01", to: "2026-11-30" }),
    ).toEqual({ signups: 0, referred: 0 });
    expect(signupStats([], { from: "2026-09-01", to: "2026-09-08" })).toEqual({
      signups: 0,
      referred: 0,
    });
  });
});

describe("autorisations", () => {
  it("trois clés libellées, aucune par défaut", () => {
    expect(CONSENT_KEYS).toEqual(["offers", "orderStatus", "marketing"]);
    expect(Object.keys(CONSENT_LABELS)).toEqual([...CONSENT_KEYS]);
    expect(grantedConsentCount(NO_CONSENTS)).toBe(0);
    expect(
      grantedConsentCount({
        offers: true,
        orderStatus: false,
        marketing: true,
        updatedAt: null,
      }),
    ).toBe(2);
  });
});
