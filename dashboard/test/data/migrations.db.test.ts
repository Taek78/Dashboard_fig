import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TEST_DATABASE_URL } from "../support/config";

/*
 * Migrations rejouées DEPUIS LA VERSION PRÉCÉDENTE avec des données (audit du
 * 2026-09-17) : la CI applique déjà toutes les migrations sur une base vide,
 * mais une migration qui transforme des lignes existantes (0014 : découpe des
 * noms) ne se vérifie qu'avec des lignes. Une base jetable est créée sur le
 * serveur de test, les fichiers SQL du dossier drizzle/ sont appliqués dans
 * l'ordre du journal jusqu'à une étape, des lignes de l'ancienne forme sont
 * insérées, puis les migrations suivantes sont appliquées et le résultat relu.
 * Hors transaction annulée : la base est supprimée à la fin.
 */
const MIGRATIONS = path.resolve(process.cwd(), "drizzle");
const dbName = `fig_migrations_${randomBytes(4).toString("hex")}`;
const dbUrl = (() => {
  const url = new URL(TEST_DATABASE_URL);
  url.pathname = `/${dbName}`;
  return url.toString();
})();

let admin: ReturnType<typeof postgres>;
let sql: ReturnType<typeof postgres>;

type Journal = { entries: { idx: number; tag: string }[] };

async function journalTags(): Promise<string[]> {
  const journal = JSON.parse(
    await readFile(path.join(MIGRATIONS, "meta", "_journal.json"), "utf8"),
  ) as Journal;
  return journal.entries
    .toSorted((a, b) => a.idx - b.idx)
    .map((entry) => entry.tag);
}

/** Applique les migrations dont le tag est dans [from, to] (bornes incluses, par index du journal). */
async function apply(tags: string[], from: number, to: number): Promise<void> {
  for (const tag of tags.slice(from, to + 1)) {
    const text = await readFile(path.join(MIGRATIONS, `${tag}.sql`), "utf8");
    for (const statement of text.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) await sql.unsafe(trimmed);
    }
  }
}

beforeAll(async () => {
  admin = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
  await admin.unsafe(`create database "${dbName}"`);
  sql = postgres(dbUrl, { max: 1, onnotice: () => {} });
});

afterAll(async () => {
  await sql?.end();
  await admin.unsafe(`drop database if exists "${dbName}" with (force)`);
  await admin.end();
});

describe("migrations depuis la version précédente", () => {
  it("0014 découpe les anciens noms des comptes, 0015 ajoute la colonne d'expiration ; tout le journal s'applique dans l'ordre", async () => {
    const tags = await journalTags();
    const before = tags.indexOf("0014_prenom-nom-comptes");
    expect(before).toBeGreaterThan(0);
    expect(tags[before + 1]).toBe("0015_invitations-expirees");

    // Jusqu'à 0013 : la table users porte encore `name`.
    await apply(tags, 0, before - 1);
    await sql`insert into users (id, email, name, role, password_hash) values
      ('u1', 'zaki@fig.invalid', 'Zaki Affane', 'admin', 'scrypt$a$b'),
      ('u2', 'admin@fig.invalid', 'Administrateur', 'gestionnaire', null),
      ('u3', 'jean@fig.invalid', '  Jean  Le Gall ', 'lecture', 'scrypt$c$d')`;

    // Puis le reste du journal, données en place.
    await apply(tags, before, tags.length - 1);

    const rows = await sql<
      {
        id: string;
        first_name: string;
        last_name: string;
        expired: Date | null;
      }[]
    >`select id, first_name, last_name, invitation_expired_at as expired from users order by id`;
    expect(rows).toEqual([
      { id: "u1", first_name: "Zaki", last_name: "Affane", expired: null },
      { id: "u2", first_name: "", last_name: "Administrateur", expired: null },
      { id: "u3", first_name: "Jean", last_name: "Le Gall", expired: null },
    ]);
    const columns = await sql<{ column_name: string }[]>`select column_name
      from information_schema.columns where table_name = 'users'`;
    expect(columns.map((c) => c.column_name)).not.toContain("name");

    // L'index unique du couple prénom + nom, sans casse ni accent, est en place.
    await expect(
      sql`insert into users (id, email, first_name, last_name, role) values
        ('u4', 'autre@fig.invalid', 'zaki', 'AFFANE', 'lecture')`,
    ).rejects.toThrow(/users_full_name_normalized_idx/);
  });
});
