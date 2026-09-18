import { after } from "next/server";
import { apiRoute, json, preflight } from "@/app/api/v1/_lib/context";
import { issueLoginCode } from "@/data/api-auth";
import { findCustomerByEmail } from "@/data/customers";
import { checkQuota, recordQuotaUse } from "@/data/login-attempts";
import { trySendMail } from "@/data/mail";
import { logSecurity } from "@/data/security-log";
import { requestCodeSchema } from "@/domain/api/schemas";
import { customerLoginCodeMail } from "@/domain/customers/mails";
import { rateLimited } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request";
import { getEnv } from "@/lib/env";
import { generateRecoveryCode, hashSecret } from "@/lib/secrets";

/*
 * POST /api/v1/auth/code { email } : envoie un code de connexion à six
 * chiffres à l'adresse, connue ou non (c'est aussi le chemin de
 * l'inscription : le code prouve que la personne lit cette boîte). Quotas par
 * adresse et par IP dans login_attempts (partagés entre instances), HMAC du
 * code en base, mail envoyé APRÈS la réponse (after). Réponse identique que
 * l'adresse existe ou non : 202 et la fin de validité du code.
 */
export const dynamic = "force-dynamic";
const METHODS = ["POST"] as const;
export const OPTIONS = preflight(METHODS);

export const POST = apiRoute(METHODS, async (call) => {
  const { email } = await readJsonBody(call.request, requestCodeSchema);
  const nowMs = call.now.getTime();
  const decision = await checkQuota("api_code", email, call.ip, nowMs);
  if (!decision.allowed) {
    logSecurity({
      type: "api_code_throttled",
      email,
      ip: call.ip,
      retryAfterMs: decision.retryAfterMs,
    });
    throw rateLimited(decision.retryAfterMs);
  }
  await recordQuotaUse("api_code", email, call.ip, nowMs);

  const customer = await findCustomerByEmail(email);
  const code = generateRecoveryCode();
  const issued = await issueLoginCode({
    email,
    codeHash: hashSecret(code, getEnv().AUTH_SECRET),
    requestedIp: call.ip,
    now: call.now,
  });
  const mail = customerLoginCodeMail({ to: { email }, code });
  after(() => trySendMail("customer_login_code", mail));
  logSecurity({
    type: "api_code_requested",
    email,
    ip: call.ip,
    customerId: customer?.id ?? null,
  });
  return json(call, { ok: true, expiresAt: issued.expiresAt }, { status: 202 });
});
