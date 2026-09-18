import { describe, expect, it } from "vitest";
import {
  describeSecurityEvent,
  metaOf,
  SECURITY_EVENT_META,
  SECURITY_FAMILIES,
  SECURITY_FAMILY_LABELS,
  typesOfFamily,
  type SecurityEventType,
} from "@/domain/security/events";

/*
 * Libellés et phrases du journal. Deux exigences tenues ici :
 * - chaque type connu a un libellé, une famille et un ton (le Record sur le
 *   type union le garantit à la compilation ; ce test garantit le contenu) ;
 * - une ligne relue de la base n'est jamais du JSON de confiance : un détail
 *   manquant, nul ou d'une version plus ancienne doit donner une phrase
 *   lisible, pas une exception devant quelqu'un qui enquête.
 */
const TYPES = Object.keys(SECURITY_EVENT_META) as SecurityEventType[];

describe("libellés du journal", () => {
  it("donne à chaque type un libellé français, une famille et un ton", () => {
    expect(TYPES.length).toBeGreaterThan(40);
    for (const type of TYPES) {
      const meta = SECURITY_EVENT_META[type];
      expect(meta.label.length).toBeGreaterThan(3);
      // Le libellé est du français, pas la clé technique recopiée.
      expect(meta.label).not.toBe(type);
      expect(SECURITY_FAMILIES).toContain(meta.family);
    }
    // Chaque famille est utilisée : aucune case à cocher ne reste vide.
    for (const family of SECURITY_FAMILIES) {
      expect(typesOfFamily(family).length).toBeGreaterThan(0);
      expect(SECURITY_FAMILY_LABELS[family].length).toBeGreaterThan(3);
    }
    expect(TYPES.flatMap(() => []).length).toBe(0);
    expect(
      SECURITY_FAMILIES.flatMap(typesOfFamily).sort((a, b) =>
        a.localeCompare(b),
      ),
    ).toEqual([...TYPES].sort((a, b) => a.localeCompare(b)));
  });

  it("marque en alerte ce qu'on vient chercher après un incident", () => {
    for (const type of [
      "login_failure",
      "login_locked",
      "forbidden",
      "recovery_locked",
      "api_service_forbidden",
      "api_rate_limited",
      "invitation_mail_failed",
      "mail_failed",
    ] as const) {
      expect(SECURITY_EVENT_META[type].tone).toBe("alerte");
    }
    // Ce qui est irréversible ou retire un accès est « sensible », pas « courant ».
    for (const type of [
      "account_deleted",
      "account_deactivated",
      "customer_exported",
      "customer_anonymized",
      "product_deleted",
    ] as const) {
      expect(SECURITY_EVENT_META[type].tone).toBe("sensible");
    }
    // Un accès NOUVEAU est vert : c'est ce qu'un administrateur relit en
    // premier quand il vérifie qui a obtenu quoi (demande du 2026-09-18).
    expect(SECURITY_EVENT_META.account_created.tone).toBe("creation");
    expect(SECURITY_EVENT_META.login_success.tone).toBe("normal");
  });

  it("reste lisible devant un type inconnu, écrit par une autre version", () => {
    const meta = metaOf("chose_inconnue");
    expect(meta.label).toBe("chose_inconnue");
    // Aucune famille : cocher une famille ne doit pas le faire remonter.
    expect(meta.family).toBeNull();
    expect(meta.tone).toBe("normal");
    expect(describeSecurityEvent("chose_inconnue", { qui: "usr-1" })).toContain(
      "usr-1",
    );
  });
});

describe("phrase d'un événement", () => {
  it("dit qui, sur quoi et depuis où", () => {
    expect(
      describeSecurityEvent("login_failure", {
        email: "zaki@fig.invalid",
        ip: "203.0.113.4",
      }),
    ).toBe("zaki@fig.invalid, depuis 203.0.113.4");
    expect(
      describeSecurityEvent("order_status_changed", {
        userId: "usr-1",
        orderId: "cmd-9",
        from: "preparing",
        to: "delivered",
      }),
    ).toBe("commande cmd-9 : preparing → delivered, par usr-1");
    expect(
      describeSecurityEvent("customer_anonymized", {
        userId: "usr-1",
        customerId: "cli-0001",
      }),
    ).toBe("client cli-0001, par usr-1");
    expect(
      describeSecurityEvent("catalog_settings_changed", {
        userId: "usr-1",
        sellWhenOutOfStock: true,
      }),
    ).toBe("vente à stock 0 activée, par usr-1");
  });

  it("distingue un champ nul d'un champ manquant, sans jamais échouer", () => {
    // Affectation retirée : le nul a un sens métier, il se dit.
    expect(
      describeSecurityEvent("order_staff_assigned", {
        userId: "usr-1",
        orderId: "cmd-9",
        role: "driver",
        staffId: null,
      }),
    ).toBe("commande cmd-9 : driver retiré, par usr-1");
    // Aucun compte à l'adresse : la demande de récupération le précise.
    expect(
      describeSecurityEvent("recovery_requested", {
        email: "inconnu@fig.invalid",
        ip: "203.0.113.4",
        userId: null,
      }),
    ).toContain("aucun compte à cette adresse");
    // Détails absents (ligne ancienne) : des tirets, pas une exception.
    expect(describeSecurityEvent("login_success", {})).toBe("—, depuis —");
    expect(() => describeSecurityEvent("api_session_opened", {})).not.toThrow();
  });

  it("ne fait jamais apparaître un secret : il n'y en a aucun à afficher", () => {
    // Le type union de l'écriture ne porte ni jeton ni mot de passe ; la
    // phrase ne peut donc pas en montrer. On vérifie qu'on n'en invente pas.
    for (const type of TYPES) {
      const phrase = describeSecurityEvent(type, {
        jeton: "secret-a-ne-pas-montrer",
      });
      expect(phrase).not.toContain("secret-a-ne-pas-montrer");
    }
  });
});
