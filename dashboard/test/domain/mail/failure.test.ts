import { describe, expect, it } from "vitest";
import {
  MAIL_FAILURE_FIXES,
  MAIL_FAILURE_LABELS,
  MAIL_FAILURE_REASONS,
  mailFailureOfNetworkError,
  mailFailureOfStatus,
  mailFailureText,
} from "@/domain/mail/failure";

/*
 * Les causes d'échec d'un envoi : ce que l'administrateur lit quand une
 * invitation n'est pas partie. Deux exigences tenues ici : chaque cause a une
 * phrase ET un geste (une cause sans geste laisse l'écran sans issue), et la
 * traduction d'un code HTTP ne dépend jamais du corps de la réponse, qui
 * n'est pas lu.
 */
describe("causes d'échec d'un envoi", () => {
  it("traduit les réponses du fournisseur en causes distinctes", () => {
    expect(mailFailureOfStatus(400)).toBe("adresse_refusee");
    expect(mailFailureOfStatus(422)).toBe("adresse_refusee");
    expect(mailFailureOfStatus(401)).toBe("configuration");
    expect(mailFailureOfStatus(403)).toBe("configuration");
    expect(mailFailureOfStatus(429)).toBe("quota_depasse");
    expect(mailFailureOfStatus(500)).toBe("service_indisponible");
    expect(mailFailureOfStatus(503)).toBe("service_indisponible");
    // Un code inattendu ne fait pas taire l'écran : il reste « autre ».
    expect(mailFailureOfStatus(418)).toBe("autre");
  });

  it("range le délai dépassé et la panne réseau dans « injoignable »", () => {
    expect(mailFailureOfNetworkError("TimeoutError")).toBe("injoignable");
    expect(mailFailureOfNetworkError("AbortError")).toBe("injoignable");
    expect(mailFailureOfNetworkError("TypeError")).toBe("injoignable");
    expect(mailFailureOfNetworkError("RangeError")).toBe("autre");
    expect(mailFailureOfNetworkError("")).toBe("autre");
  });

  it("donne à chaque cause une phrase et un geste, tous différents", () => {
    for (const reason of MAIL_FAILURE_REASONS) {
      expect(MAIL_FAILURE_LABELS[reason].length).toBeGreaterThan(10);
      expect(MAIL_FAILURE_FIXES[reason].length).toBeGreaterThan(10);
      expect(mailFailureText(reason)).toContain(MAIL_FAILURE_LABELS[reason]);
      expect(mailFailureText(reason)).toContain(MAIL_FAILURE_FIXES[reason]);
    }
    const labels = MAIL_FAILURE_REASONS.map((r) => MAIL_FAILURE_LABELS[r]);
    expect(new Set(labels).size).toBe(MAIL_FAILURE_REASONS.length);
  });

  it("ne propose jamais de corriger l'adresse quand elle n'est pas en cause", () => {
    // Le geste d'une panne du service ne doit pas envoyer l'admin réécrire l'e-mail.
    expect(MAIL_FAILURE_FIXES.service_indisponible).not.toMatch(/adresse/i);
    expect(MAIL_FAILURE_FIXES.quota_depasse).not.toMatch(/adresse/i);
    expect(MAIL_FAILURE_FIXES.adresse_refusee).toMatch(/orthographe/i);
  });
});
