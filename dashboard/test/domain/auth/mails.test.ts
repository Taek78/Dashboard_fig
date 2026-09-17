import { describe, expect, it } from "vitest";
import {
  accountActivatedMail,
  accountDeactivatedMail,
  accountDeletedMail,
  adminAccountActivatedMail,
  adminAccountLockedMail,
  adminContact,
  adminInvitationExpiredMail,
  adminPasswordRecoveredMail,
  adminRecoveryLockedMail,
  emailReminderMail,
  invitationExpiredMail,
  invitationMail,
  passwordRecoveredMail,
  recoveryCodeMail,
} from "@/domain/auth/mails";

const zaki = { email: "zaki@fig.invalid", name: "Zaki" };
const admin = { email: "admin@fig.invalid", name: "Amel" };
const account = { name: "Zaki", email: "zaki@fig.invalid" };
const AT = "2026-09-17T08:30:00.000Z";
const SIGNED =
  /Bien cordialement,\nL'équipe FIG\n\nFIG Back-office\nMessage automatique/;

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

  it("désactivation et suppression : ton professionnel, date, administrateur à contacter avec son adresse ; la suppression dit qu'un nouveau compte peut être créé à la même adresse, par un administrateur seulement", () => {
    const off = accountDeactivatedMail({ to: zaki, at: AT, admin });
    expect(off.to).toEqual(zaki);
    expect(off.subject).toMatch(/désactivé/);
    expect(off.text).toContain("Bonjour Zaki");
    expect(off.text).toContain("zaki@fig.invalid");
    expect(off.text).toMatch(/2026/);
    expect(off.text).toMatch(/n'est pas supprimé/);
    expect(off.text).toContain(
      "contactez votre administrateur, Amel (admin@fig.invalid).",
    );

    const gone = accountDeletedMail({ to: zaki, at: AT, admin });
    expect(gone.to).toEqual(zaki);
    expect(gone.subject).toMatch(/supprimé/);
    expect(gone.text).toContain("depuis cette adresse");
    expect(gone.text).toMatch(/Seul un administrateur est habilité/);
    expect(gone.text).toContain(
      "contactez votre administrateur, Amel (admin@fig.invalid).",
    );
    for (const mail of [off, gone]) {
      expect(mail.text).not.toMatch(/jeton|code|mot de passe/i);
      expect(mail.text).toMatch(SIGNED);
    }
  });

  it("adminContact nomme l'administrateur avec son adresse, la liste s'ils sont plusieurs, le mot seul sinon", () => {
    expect(adminContact([])).toBe("votre administrateur");
    expect(adminContact([admin])).toBe(
      "votre administrateur, Amel (admin@fig.invalid)",
    );
    expect(adminContact([{ name: "Amel", email: "" }])).toBe(
      "votre administrateur, Amel",
    );
    expect(
      adminContact([admin, { name: "Karim", email: "karim@fig.invalid" }]),
    ).toBe(
      "l'un de vos administrateurs : Amel (admin@fig.invalid), Karim (karim@fig.invalid)",
    );
  });

  it("compte activé : à la personne tout ce qu'il faut pour se connecter (jamais le mot de passe), aux administrateurs l'information", () => {
    const welcome = accountActivatedMail({
      to: zaki,
      at: AT,
      role: "gestionnaire",
      loginUrl: "https://fig.example.invalid/connexion",
      admins: [admin],
      by: null,
    });
    expect(welcome.to).toEqual(zaki);
    expect(welcome.subject).toMatch(/activé/);
    expect(welcome.text).toContain("Bonjour Zaki");
    expect(welcome.text).toContain("17 sept. 2026");
    expect(welcome.text).toContain("https://fig.example.invalid/connexion");
    expect(welcome.text).toContain("identifiant : zaki@fig.invalid");
    expect(welcome.text).toContain("celui que vous venez de choisir");
    expect(welcome.text).toContain("rôle attribué : Gestionnaire");
    expect(welcome.text).toMatch(/Mot de passe oublié/);
    expect(welcome.text).toMatch(/pas à l'origine de cette activation/);
    expect(welcome.text).toContain(
      "contactez votre administrateur, Amel (admin@fig.invalid).",
    );
    expect(welcome.text).toMatch(SIGNED);

    const given = accountActivatedMail({
      to: zaki,
      at: AT,
      role: "lecture",
      loginUrl: "https://fig.example.invalid/connexion",
      admins: [admin],
      by: "Amel",
    });
    expect(given.text).toContain("celui que Amel vous a attribué");
    expect(given.text).toMatch(/Changez-le dès votre première connexion/);

    const notice = adminAccountActivatedMail({
      to: admin,
      account: { ...account, role: "gestionnaire" },
      at: AT,
      comptesUrl: "https://fig.example.invalid/comptes",
      by: null,
    });
    expect(notice.to).toEqual(admin);
    expect(notice.subject).toBe("Compte activé : Zaki");
    expect(notice.text).toContain("Bonjour Amel");
    expect(notice.text).toContain("Zaki (zaki@fig.invalid) vient d'activer");
    expect(notice.text).toContain("Rôle attribué : Gestionnaire");
    expect(notice.text).toMatch(/rien à faire/);
    expect(notice.text).toContain("https://fig.example.invalid/comptes");
    expect(
      adminAccountActivatedMail({
        to: admin,
        account: { ...account, role: "lecture" },
        at: AT,
        comptesUrl: "https://x.invalid/comptes",
        by: "Karim",
      }).text,
    ).toContain("activé le");
    for (const mail of [welcome, given, notice]) {
      expect(mail.text).not.toMatch(/jeton=|\b\d{6}\b/);
      expect(mail.text).toMatch(SIGNED);
    }
  });

  it("invitation expirée : à la personne rien d'activé et un nouveau lien à demander, aux administrateurs les deux gestes", () => {
    const person = invitationExpiredMail({
      to: zaki,
      expiresAt: AT,
      admins: [admin],
    });
    expect(person.to).toEqual(zaki);
    expect(person.subject).toMatch(/invitation .* a expiré/);
    expect(person.text).toContain("Bonjour Zaki");
    expect(person.text).toContain("a expiré le jeu. 17 sept. 2026, 10:30");
    expect(person.text).toContain("48 heures");
    expect(person.text).toContain("Aucun compte n'est donc actif");
    expect(person.text).toContain("zaki@fig.invalid");
    expect(person.text).toMatch(/Seul un administrateur est habilité/);
    expect(person.text).toMatch(/pas cette invitation, vous pouvez ignorer/);
    expect(person.text).toContain(
      "contactez votre administrateur, Amel (admin@fig.invalid).",
    );

    const alert = adminInvitationExpiredMail({
      to: admin,
      account: { ...account, role: "livreur" },
      expiresAt: AT,
      comptesUrl: "https://fig.example.invalid/comptes",
    });
    expect(alert.to).toEqual(admin);
    expect(alert.subject).toBe(
      "Invitation expirée : Zaki n'a pas activé son compte",
    );
    expect(alert.text).toContain("Zaki (zaki@fig.invalid)");
    expect(alert.text).toContain("rôle Livreur");
    expect(alert.text).toContain("« Renvoyer l'invitation »");
    expect(alert.text).toContain("« Annuler l'invitation »");
    expect(alert.text).toContain("https://fig.example.invalid/comptes");
    for (const mail of [person, alert]) {
      expect(mail.text).not.toMatch(/jeton=|mot de passe :/);
      expect(mail.text).toMatch(SIGNED);
    }
  });

  it("le rappel d'adresse redit l'adresse qui reçoit le mail", () => {
    const mail = emailReminderMail({ to: zaki });
    expect(mail.subject).toMatch(/adresse de connexion/);
    expect(mail.text).toContain("c'est zaki@fig.invalid");
    expect(mail.text).toMatch(/rien n'a changé/);
  });
});
