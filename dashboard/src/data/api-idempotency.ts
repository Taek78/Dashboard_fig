import "server-only";
import { apiIdempotencyDb } from "@/data/api-idempotency.db";
import type { IdempotencySource } from "@/domain/api/source";

/* FAÇADE des clés d'idempotence de l'API ; implémentation PostgreSQL (api-idempotency.db.ts). */
export const {
  claim: claimIdempotencyKey,
  complete: completeIdempotencyKey,
  release: releaseIdempotencyKey,
}: IdempotencySource = apiIdempotencyDb;
