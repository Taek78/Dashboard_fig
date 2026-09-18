import { describe, expect, it } from "vitest";
import { customerLoginCodeMail } from "@/domain/customers/mails";

describe("customerLoginCodeMail", () => {
  it("donne le code seul, sa validité, la consigne et une signature, sans nommer la personne", () => {
    const mail = customerLoginCodeMail({
      to: { email: "amel.benali@example.invalid" },
      code: "042917",
    });
    expect(mail.to).toEqual({ email: "amel.benali@example.invalid" });
    expect(mail.subject).toBe("Votre code de connexion FIG");
    expect(mail.text).toMatch(/^Bonjour,\n/);
    expect(mail.text).toMatch(/\n {4}042917\n/);
    expect(mail.text).toContain("valable 10 minutes");
    expect(mail.text).toContain("ne sert qu'une fois");
    expect(mail.text).toContain("Si vous n'avez rien demandé");
    expect(mail.text).toMatch(/L'équipe FIG/);
    expect(mail.text).not.toContain("http");
  });
});
