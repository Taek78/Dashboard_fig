import { describe, expect, it } from "vitest";
import {
  createMessageSchema,
  createOrderSchema,
  deliverySlotSchema,
  idempotencyKeySchema,
  listQuerySchema,
  openSessionSchema,
  requestCodeSchema,
  signupSchema,
  updateProfileSchema,
} from "@/domain/api/schemas";

const signup = {
  fullName: "Nadia Lemaire",
  phone: "06 39 98 00 42",
  addressLine: "3 rue des Vignes",
  city: "Paris",
  postalCode: "75012",
  consents: { offers: true, orderStatus: true, marketing: false },
};

describe("schémas d'accès", () => {
  it("normalise l'e-mail et exige six chiffres", () => {
    expect(requestCodeSchema.parse({ email: "Nadia@Example.INVALID" })).toEqual(
      {
        email: "nadia@example.invalid",
      },
    );
    expect(requestCodeSchema.safeParse({ email: "pas-un-mail" }).success).toBe(
      false,
    );
    expect(
      openSessionSchema.safeParse({ email: "a@b.invalid", code: "12345" })
        .success,
    ).toBe(false);
    expect(
      openSessionSchema.parse({ email: "a@b.invalid", code: " 123456 " }),
    ).toEqual({ email: "a@b.invalid", code: "123456", signup: undefined });
  });

  it("le profil d'inscription borne chaque champ et accepte parrain et communauté", () => {
    expect(signupSchema.parse(signup)).toEqual(signup);
    expect(
      signupSchema.parse({
        ...signup,
        addressLine: null,
        referralCode: "Benali#0001",
        communityId: "com-0001",
      }),
    ).toMatchObject({ addressLine: null, referralCode: "Benali#0001" });
    for (const bad of [
      { fullName: "N" },
      { phone: "abc" },
      { postalCode: "7501" },
      { consents: { offers: true } },
      { city: "" },
    ]) {
      expect(signupSchema.safeParse({ ...signup, ...bad }).success).toBe(false);
    }
  });

  it("la modification du profil exige au moins un champ et n'accepte pas l'e-mail", () => {
    expect(updateProfileSchema.safeParse({}).success).toBe(false);
    expect(updateProfileSchema.parse({ city: "Lyon" })).toEqual({
      city: "Lyon",
    });
    expect(
      updateProfileSchema.parse({ email: "x@y.invalid", city: "Lyon" }),
    ).toEqual({ city: "Lyon" });
  });
});

describe("schémas de commande", () => {
  it("déduit la fin du créneau et refuse une heure non pile", () => {
    expect(
      deliverySlotSchema.parse({ date: "2026-09-20", start: "14:00" }),
    ).toEqual({
      date: "2026-09-20",
      start: "14:00",
      end: "15:00",
    });
    expect(
      deliverySlotSchema.safeParse({ date: "2026-09-20", start: "14:30" })
        .success,
    ).toBe(false);
    expect(
      deliverySlotSchema.safeParse({ date: "20/09/2026", start: "14:00" })
        .success,
    ).toBe(false);
  });

  it("borne les lignes, exige le total attendu et accepte une référence de paiement", () => {
    const order = {
      lines: [{ productId: "prd-0001", quantity: 1000 }],
      deliverySlot: { date: "2026-09-20", start: "10:00" },
      expectedTotalCents: 780,
      paymentReference: "pay_123",
    };
    expect(createOrderSchema.parse(order)).toMatchObject({
      expectedTotalCents: 780,
      paymentReference: "pay_123",
      deliverySlot: { end: "11:00" },
    });
    expect(createOrderSchema.safeParse({ ...order, lines: [] }).success).toBe(
      false,
    );
    expect(
      createOrderSchema.safeParse({
        ...order,
        lines: [{ productId: "prd-0001", quantity: 0 }],
      }).success,
    ).toBe(false);
    expect(
      createOrderSchema.safeParse({
        ...order,
        lines: [{ productId: "prd-0001", quantity: 1.5 }],
      }).success,
    ).toBe(false);
    expect(
      createOrderSchema.safeParse({ ...order, expectedTotalCents: -1 }).success,
    ).toBe(false);
  });
});

describe("schémas de message et de liste", () => {
  it("exige un objet connu, un texte borné et dix identifiants de fichiers au plus", () => {
    const message = {
      subject: "delivery_issue",
      body: "Le livreur n'est pas passé.",
      fileIds: ["b3f1a2c4-0000-4000-8000-000000000001"],
    };
    const parsed = createMessageSchema.parse(message);
    expect(parsed.subject).toBe("delivery_issue");
    expect(parsed.orderId).toBeUndefined();
    expect(parsed.fileIds).toEqual(["b3f1a2c4-0000-4000-8000-000000000001"]);
    expect(
      createMessageSchema.safeParse({ ...message, subject: "spam" }).success,
    ).toBe(false);
    expect(
      createMessageSchema.safeParse({ ...message, fileIds: [""] }).success,
    ).toBe(false);
    expect(
      createMessageSchema.safeParse({
        ...message,
        fileIds: Array.from({ length: 11 }, (_, i) => `f-${i}`),
      }).success,
    ).toBe(false);
    // L'ancienne forme (métadonnées et URL) est refusée, pas ignorée : aucune pièce jointe ne se perd en silence.
    const legacy = createMessageSchema.safeParse({
      ...message,
      attachments: [{ url: "https://ailleurs.invalid/a.jpg" }],
    });
    expect(legacy.success).toBe(false);
    expect(legacy.error?.issues[0]?.message).toMatch(/POST \/fichiers/);
  });

  it("la liste a une taille par défaut de 20, 50 au plus ; la clé d'idempotence est bornée", () => {
    expect(listQuerySchema.parse({})).toEqual({ limit: 20, cursor: undefined });
    expect(listQuerySchema.parse({ limit: "50", cursor: "abc" })).toEqual({
      limit: 50,
      cursor: "abc",
    });
    expect(listQuerySchema.safeParse({ limit: "51" }).success).toBe(false);
    expect(idempotencyKeySchema.safeParse("court").success).toBe(false);
    expect(idempotencyKeySchema.safeParse("cle avec espaces").success).toBe(
      false,
    );
    expect(
      idempotencyKeySchema.parse("b3f1a2c4-0000-4000-8000-000000000000"),
    ).toBe("b3f1a2c4-0000-4000-8000-000000000000");
  });
});
