import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/*
 * Envoi de mail : transport fichier (un JSON par mail), transport Brevo (une
 * requête HTTP, fetch simulé), et la façade qui choisit selon l'environnement
 * (simulé) sans jamais casser l'action appelante (trySendMail).
 */
const env = vi.hoisted(() => ({
  current: {} as Record<string, string | undefined>,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    DATABASE_URL: "postgresql://fig:fig@localhost:5432/fig",
    AUTH_SECRET: "a".repeat(32),
    ...env.current,
  }),
}));
const logged = vi.hoisted(() => [] as Record<string, unknown>[]);
vi.mock("@/data/security-log", () => ({
  logSecurity: (event: Record<string, unknown>) => {
    logged.push(event);
  },
}));

const { sendToFile } = await import("@/data/mail.file");
const { sendWithBrevo } = await import("@/data/mail.brevo");
const { sendMail, trySendMail } = await import("@/data/mail");

const message = {
  to: { email: "zaki@fig.invalid", name: "Zaki" },
  subject: "Votre code",
  text: "Bonjour Zaki,\n\n042917",
};

let dir = "";
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "fig-mail-"));
});
afterAll(() => rm(dir, { recursive: true, force: true }));

describe("sendToFile", () => {
  it("écrit un JSON daté, un fichier par mail, dans un dossier créé au besoin", async () => {
    const sub = join(dir, "sous", "dossier");
    const path = await sendToFile(
      message,
      sub,
      new Date("2026-09-17T10:00:00.000Z"),
    );
    expect(path.startsWith(sub)).toBe(true);
    expect(JSON.parse(await readFile(path, "utf8"))).toEqual({
      ...message,
      at: "2026-09-17T10:00:00.000Z",
    });
    await sendToFile(message, sub);
    expect((await readdir(sub)).length).toBe(2);
  });
});

describe("sendWithBrevo", () => {
  it("poste le mail en texte brut avec la clé d'API, sans rien d'autre", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 201 }));
    await sendWithBrevo(
      message,
      {
        apiKey: "xkeysib-test",
        from: { email: "noreply@fig.invalid", name: "FIG" },
      },
      fetchImpl as unknown as typeof fetch,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["api-key"]).toBe(
      "xkeysib-test",
    );
    expect(JSON.parse(String(init.body))).toEqual({
      sender: { email: "noreply@fig.invalid", name: "FIG" },
      to: [{ email: "zaki@fig.invalid", name: "Zaki" }],
      subject: "Votre code",
      textContent: "Bonjour Zaki,\n\n042917",
    });
  });

  it("échoue sur une réponse non 2xx, avec le code seulement", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("secret body", { status: 401 }),
    );
    await expect(
      sendWithBrevo(
        message,
        { apiKey: "k", from: { email: "n@fig.invalid", name: "FIG" } },
        fetchImpl as unknown as typeof fetch,
      ),
    ).rejects.toThrow(/401/);
  });
});

describe("façade sendMail / trySendMail", () => {
  it("transport fichier : écrit dans MAIL_FILE_DIR", async () => {
    const target = join(dir, "facade");
    env.current = { MAIL_TRANSPORT: "fichier", MAIL_FILE_DIR: target };
    await sendMail(message);
    expect((await readdir(target)).length).toBe(1);
    expect(await trySendMail("test", message)).toBe(true);
    expect((await readdir(target)).length).toBe(2);
  });

  it("transport brevo sans clé : sendMail échoue, trySendMail renvoie false et journalise", async () => {
    env.current = { MAIL_TRANSPORT: "brevo" };
    await expect(sendMail(message)).rejects.toThrow(/MAIL_API_KEY/);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await trySendMail("recovery_code", message)).toBe(false);
    error.mockRestore();
    expect(logged).toContainEqual({
      type: "mail_failed",
      kind: "recovery_code",
    });
    // Ni l'adresse ni le texte ne partent au journal de sécurité.
    expect(JSON.stringify(logged)).not.toContain("zaki@fig.invalid");
  });
});
