import { requireCustomer } from "@/app/api/v1/_lib/auth";
import {
  apiRoute,
  json,
  noContent,
  preflight,
} from "@/app/api/v1/_lib/context";
import { accountClosed, viewOf } from "@/app/api/v1/_lib/customers";
import {
  consumeLoginCode,
  findActiveLoginCode,
  openSession,
  recordLoginCodeAttempt,
  revokeSession,
  signupCustomer,
} from "@/data/api-auth";
import { findCustomerByEmail } from "@/data/customers";
import { logSecurity } from "@/data/security-log";
import { openSessionSchema } from "@/domain/api/schemas";
import {
  isLoginCodeUsable,
  LOGIN_CODE_MAX_ATTEMPTS,
} from "@/domain/api/session";
import { sessionView } from "@/domain/api/views";
import { ApiError } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request";
import { getEnv } from "@/lib/env";
import { generateLinkToken, hashSecret, secretsMatch } from "@/lib/secrets";

/*
 * POST /api/v1/auth/session { email, code, signup? } : vérifie le code
 * (dernier code actif de l'adresse, comparaison des HMAC à temps constant,
 * cinq essais puis annulation, consommation conditionnelle), puis :
 * - adresse connue : ouvre une session (jeton remis une seule fois) ;
 * - adresse inconnue : sans `signup`, 404 signup_required SANS consommer le
 *   code (l'application affiche alors le formulaire d'inscription et renvoie
 *   le même code avec le profil) ; avec `signup`, crée le client et la
 *   session en une transaction.
 * DELETE /api/v1/auth/session : révoque la session du jeton (déconnexion).
 */
export const dynamic = "force-dynamic";
const METHODS = ["POST", "DELETE"] as const;
export const OPTIONS = preflight(METHODS);

const codeInvalid = () =>
  new ApiError(
    401,
    "code_invalid",
    "Code incorrect ou expiré. Demandez un nouveau code.",
  );

export const POST = apiRoute(METHODS, async (call) => {
  const { email, code, signup } = await readJsonBody(
    call.request,
    openSessionSchema,
  );
  const nowMs = call.now.getTime();
  const key = getEnv().AUTH_SECRET;

  const active = await findActiveLoginCode(email);
  if (!active || !isLoginCodeUsable(active, nowMs)) throw codeInvalid();
  if (!secretsMatch(hashSecret(code, key), active.codeHash)) {
    const attempts = await recordLoginCodeAttempt(active.id);
    logSecurity({ type: "api_code_failed", email, ip: call.ip, attempts });
    if (attempts >= LOGIN_CODE_MAX_ATTEMPTS) {
      await consumeLoginCode(active.id, call.now);
      throw new ApiError(
        401,
        "code_locked",
        "Trop de codes erronés : ce code est annulé. Demandez un nouveau code.",
      );
    }
    throw codeInvalid();
  }

  // Adresse inconnue sans profil : le code reste valable, l'application
  // affiche le formulaire d'inscription et renvoie le MÊME code avec lui.
  const existing = await findCustomerByEmail(email);
  if (!existing && !signup) {
    throw new ApiError(
      404,
      "signup_required",
      "Aucun compte pour cette adresse : renvoyez le même code avec le profil (signup) pour en créer un.",
    );
  }
  if (!(await consumeLoginCode(active.id, call.now))) throw codeInvalid();

  const token = generateLinkToken();
  const tokenHash = hashSecret(token, key);
  if (existing) {
    if (existing.anonymizedAt !== null) throw accountClosed();
    const session = await openSession(existing.id, tokenHash, call.now);
    logSecurity({
      type: "api_session_opened",
      customerId: existing.id,
      ip: call.ip,
      signup: false,
    });
    return json(
      call,
      sessionView(token, session, await viewOf(existing, call.now), false),
    );
  }

  if (!signup) throw codeInvalid(); // impossible : traité plus haut ; garde pour tsc.
  const outcome = await signupCustomer(
    {
      email,
      fullName: signup.fullName,
      phone: signup.phone,
      addressLine: signup.addressLine ?? null,
      city: signup.city,
      postalCode: signup.postalCode,
      consents: signup.consents,
      referralCode: signup.referralCode ?? null,
      communityId: signup.communityId ?? null,
    },
    tokenHash,
    call.now,
  );
  switch (outcome.outcome) {
    case "email_taken":
      throw new ApiError(
        409,
        "email_taken",
        "Un compte existe déjà pour cette adresse : demandez un nouveau code pour vous connecter.",
      );
    case "referral_code_unknown":
      throw new ApiError(
        422,
        "referral_code_unknown",
        "Ce code de parrainage ne correspond à aucun client.",
      );
    case "community_not_joinable":
      throw new ApiError(
        422,
        "community_not_joinable",
        "Cette communauté n'est pas ouverte à l'inscription directe.",
      );
    case "created": {
      logSecurity({
        type: "api_session_opened",
        customerId: outcome.customer.id,
        ip: call.ip,
        signup: true,
      });
      return json(
        call,
        sessionView(
          token,
          outcome.session,
          await viewOf(outcome.customer, call.now),
          true,
        ),
        { status: 201 },
      );
    }
  }
});

export const DELETE = apiRoute(METHODS, async (call) => {
  const { session, customer } = await requireCustomer(call);
  await revokeSession(session.id, call.now);
  logSecurity({ type: "api_session_closed", customerId: customer.id });
  return noContent(call);
});
