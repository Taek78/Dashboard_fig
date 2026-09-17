import { timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { getEnv } from "@/lib/env";

/*
 * Route de santé. Corps strictement { ok: boolean } : jamais error.message,
 * la pile, l'hôte, la version de Postgres ni la latence. no-store : un proxy ou un
 * navigateur ne doit pas resservir un 200 pendant une panne.
 *
 * `select 1` sur le pool → 200, ou 503 si la base est injoignable.
 *
 * Deux gardes (audit du 2026-09-17) :
 * - avec HEALTH_TOKEN dans l'environnement, la route exige
 *   « Authorization: Bearer <jeton> » (comparaison à temps constant) et
 *   répond 401 sans toucher à la base sinon ; sans la variable, elle reste
 *   publique (développement, suite navigateur) ;
 * - une seule sonde de la base par fenêtre de cinq secondes : un moniteur
 *   trop insistant, ou un inconnu qui martèle la route, n'occupe jamais plus
 *   d'une connexion du pool.
 * Le proxy d'authentification l'exclut volontairement : un moniteur n'a pas
 * de session.
 */
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };
const PROBE_TTL_MS = 5_000;
let lastProbe: { at: number; ok: boolean } | null = null;

/** Sans jeton configuré, tout le monde ; sinon le porteur du bon jeton, comparé à temps constant. */
function authorized(request: Request, token: string | undefined): boolean {
  if (!token) return true;
  const header = request.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const a = Buffer.from(given);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function probe(now: number): Promise<boolean> {
  if (lastProbe && now - lastProbe.at < PROBE_TTL_MS) return lastProbe.ok;
  let ok = false;
  try {
    await getDb().execute(sql`select 1`);
    ok = true;
  } catch (error) {
    console.error("[health] base injoignable", error);
  }
  lastProbe = { at: now, ok };
  return ok;
}

export async function GET(request: Request): Promise<Response> {
  if (!authorized(request, getEnv().HEALTH_TOKEN)) {
    return Response.json(
      { ok: false },
      { status: 401, headers: { ...headers, "WWW-Authenticate": "Bearer" } },
    );
  }
  const ok = await probe(Date.now());
  return Response.json({ ok }, { status: ok ? 200 : 503, headers });
}
