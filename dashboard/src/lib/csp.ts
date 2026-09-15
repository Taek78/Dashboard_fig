/*
 * Content-Security-Policy avec nonce, pure et testée. Posée par
 * le proxy sur chaque réponse ; le nonce, unique par requête, est aussi passé
 * au layout racine (en-tête x-nonce) pour le script inline du thème, et Next
 * l'applique à ses propres scripts.
 * - script-src : seuls les scripts portant le nonce, et ceux qu'ils chargent
 *   ('strict-dynamic') ; plus d''unsafe-inline'. En développement, Turbopack a
 *   besoin d''unsafe-eval'.
 * - style-src garde 'unsafe-inline' (Next injecte des styles ; graphiques et
 *   barres placent leurs points et longueurs par des attributs style).
 * - frame-ancestors 'none' : jamais dans un cadre (détournement de clic).
 * - form-action 'self' : aucun formulaire ne peut poster ailleurs.
 */
export function buildCsp(nonce: string, isDev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}
