import { describe, expect, it } from "vitest";
import {
  adminAccountLockedMail,
  adminPasswordRecoveredMail,
  adminRecoveryLockedMail,
  emailReminderMail,
  invitationMail,
  passwordRecoveredMail,
  recoveryCodeMail,
} from "@/domain/auth/mails";

const zaki = { email: "zaki@fig.invalid", name: "Zaki" };
const admin = { email: "admin@fig.invalid", name: "Amel" };
const account = { name: "Zaki", email: "zaki@fig.invalid" };
const AT = "2026-09-17T08:30:00.000Z";

describe("mails de récupération", () => {
  it("le code, sa validité et le lien de verrouillage vont à la personne", () => {
    const mail = recoveryCodeMail({
      to: zaki,
      code: "042917",
      lockUrl: "https://fig.example.invalid/connexion/verrouiller?jeton=abc",
    });
    expect(mail.to).toEqual(zaki);
    expect(mail.subject).toMatch(/code de récupération/i);
    expect(mail.text).toContain("Bonjour Zaki");
    expect(mail.text).toContain("042917");
    expect(mail.text).toContain("5 minutes");
    expect(mail.text).toContain("/connexion/verrouiller?jeton=abc");
    expect(mail.text).toMatch(/pas à l'origine/);
  });

  it("le mot de passe changé : date, heure de Paris, IP et lien de verrouillage", () => {
    const mail = passwordRecoveredMail({
      to: zaki,
      at: AT,
      ip: "203.0.113.5",
      lockUrl: "https://fig.example.invalid/connexion/verrouiller?jeton=def",
    });
    expect(mail.subject).toMatch(/modifié/);
    expect(mail.text).toContain("17 sept. 2026");
    expect(mail.text).toContain("10:30");
    expect(mail.text).toContain("203.0.113.5");
    expect(mail.text).toContain("jeton=def");
  });

  it("les alertes aux administrateurs nomment le compte et l'IP, jamais un secret", () => {
    const recovered = adminPasswordRecoveredMail({
      to: admin,
      account,
      at: AT,
      ip: "203.0.113.5",
    });
    expect(recovered.to).toEqual(admin);
    expect(recovered.subject).toContain("Zaki");
    expect(recovered.text).toContain("zaki@fig.invalid");
    expect(recovered.text).toContain("203.0.113.5");
    expect(recovered.text).toMatch(/Comptes/);

    const locked = adminRecoveryLockedMail({
      to: admin,
      account,
      ip: "1.2.3.4",
    });
    expect(locked.subject).toMatch(/erronés/);
    expect(locked.text).toContain("5 codes");
    expect(locked.text).toContain("aucun mot de passe n'a changé");

    const byOwner = adminAccountLockedMail({
      to: admin,
      account,
      ip: "1.2.3.4",
    });
    expect(byOwner.subject).toMatch(/verrouillé son compte/);
    expect(byOwner.text).toMatch(/désactivé/);
    expect(byOwner.text).toMatch(/téléphone/);
  });

  it("l'invitation porte le lien, sa validité et qui invite, selon la raison", () => {
    const creation = invitationMail({
      to: zaki,
      url: "https://fig.example.invalid/connexion/invitation?jeton=xyz",
      byName: "Amel",
      reason: "creation",
    });
    expect(creation.subject).toMatch(/accès/);
    expect(creation.text).toContain("Amel vous a créé un compte");
    expect(creation.text).toContain("jeton=xyz");
    expect(creation.text).toContain("48 heures");

    const reset = invitationMail({
      to: zaki,
      url: "https://x.invalid/connexion/invitation?jeton=xyz",
      byName: "Amel",
      reason: "reset",
    });
    expect(reset.subject).toMatch(/nouveau mot de passe/i);
    expect(reset.text).toContain(
      "vous invite à choisir un nouveau mot de passe",
    );
  });

  it("le rappel d'adresse redit l'adresse qui reçoit le mail", () => {
    const mail = emailReminderMail({ to: zaki });
    expect(mail.subject).toMatch(/adresse de connexion/);
    expect(mail.text).toContain("c'est zaki@fig.invalid");
    expect(mail.text).toMatch(/rien n'a changé/);
  });
});
