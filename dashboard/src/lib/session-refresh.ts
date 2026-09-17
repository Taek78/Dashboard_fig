/*
 * Rafraîchissement du cookie de session : règles pures, testées dans
 * test/lib/session-refresh.test.ts, appliquées par src/proxy.ts.
 *
 * Pourquoi : Auth.js (session JWT) re-signe et re-pose le cookie de session à
 * CHAQUE requête qui lit la session, y compris les préchargements de liens
 * (`Next-Router-Prefetch`). Après une déconnexion, une réponse de
 * préchargement encore en vol re-posait donc un cookie valide : la personne
 * était reconnectée sans le savoir (constaté par le parcours Playwright de
 * déconnexion). Le proxy retire ce cookie de la réponse quand le
 * rafraîchissement n'a pas lieu d'être : requête de préchargement, ou jeton
 * encore récent (moins de la moitié de sa durée de vie écoulée). La session
 * reste glissante : une personne active voit son jeton renouvelé au plus tard
 * à mi-vie, sans dépendre du dernier octet reçu.
 */

/** Durée de vie d'une session (Auth.js `session.maxAge`), en secondes : 8 h. */
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

/** Noms possibles du cookie de session Auth.js (préfixe `__Secure-` en HTTPS). */
export const SESSION_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
] as const;

/** Vrai pour un préchargement du routeur Next (jamais besoin d'y rafraîchir la session). */
export function isPrefetch(headers: Headers): boolean {
  if (headers.get("next-router-prefetch") === "1") return true;
  const purpose = headers.get("sec-purpose") ?? headers.get("purpose") ?? "";
  return purpose.toLowerCase().includes("prefetch");
}

/**
 * Vrai si le jeton mérite d'être renouvelé : plus de `fraction` de sa durée de
 * vie est écoulée (par défaut la moitié). `exp` est l'expiration du jeton en
 * secondes (champ JWT) ; sans `exp` lisible, on laisse Auth.js faire.
 */
export function refreshDue(
  exp: number | undefined,
  nowMs: number,
  maxAgeSeconds = SESSION_MAX_AGE_SECONDS,
  fraction = 0.5,
): boolean {
  if (exp === undefined || !Number.isFinite(exp)) return true;
  const issuedAt = exp - maxAgeSeconds;
  const age = nowMs / 1000 - issuedAt;
  return age >= maxAgeSeconds * fraction;
}

/** Vrai pour un `Set-Cookie` qui EFFACE le cookie de session (valeur vide). */
function isSessionCookieDeletion(cookie: string): boolean {
  return SESSION_COOKIE_NAMES.some((name) => cookie.startsWith(`${name}=;`));
}

/**
 * Retire des en-têtes de réponse les `Set-Cookie` qui (re)posent le cookie de
 * session, en gardant tous les autres (CSRF, URL de rappel) et les
 * SUPPRESSIONS du cookie de session (session refusée par Auth.js : compte
 * désactivé, mot de passe changé), qui doivent atteindre le navigateur.
 * Renvoie le nombre de cookies retirés. Modifie `headers` en place.
 */
export function stripSessionCookies(headers: Headers): number {
  const all = headers.getSetCookie();
  const kept = all.filter(
    (cookie) =>
      isSessionCookieDeletion(cookie) ||
      !SESSION_COOKIE_NAMES.some((name) => cookie.startsWith(`${name}=`)),
  );
  if (kept.length === all.length) return 0;
  headers.delete("set-cookie");
  for (const cookie of kept) headers.append("set-cookie", cookie);
  return all.length - kept.length;
}
