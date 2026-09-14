import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { getEnv } from "@/lib/env";

/*
 * Route de santé. Corps strictement { ok: boolean } : jamais error.message,
 * la pile, l'hôte, la version de Postgres ni la latence. no-store : un proxy ou un
 * navigateur ne doit pas resservir un 200 pendant une panne.
 *
 * - DATA_SOURCE=mock : l'app est vivante, il n'y a pas de base à sonder → 200.
 * - DATA_SOURCE=db : `select 1` sur le pool → 200, ou 503 si la base est injoignable.
 *
 * Risque en production : route publique, chaque appel occupe une
 * connexion du pool de 5. À protéger avant la mise en ligne (jeton, reverse proxy, limitation).
 * Le proxy d'authentification l'exclut volontairement : un moniteur n'a pas de session.
 */
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

export async function GET(): Promise<Response> {
  if (getEnv().DATA_SOURCE === "mock") {
    return Response.json({ ok: true }, { headers });
  }
  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ ok: true }, { headers });
  } catch (error) {
    console.error("[health] base injoignable", error);
    return Response.json({ ok: false }, { status: 503, headers });
  }
}
