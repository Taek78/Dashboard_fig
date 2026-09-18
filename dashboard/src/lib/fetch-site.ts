/*
 * Vrai si la requête vient d'un AUTRE site (lien piégé, image intégrée
 * ailleurs), d'après l'en-tête Sec-Fetch-Site que posent les navigateurs.
 * Sans l'en-tête (outil en ligne de commande), rien n'est présumé : la session
 * et le rôle décident seuls. Partagé par les routes qui rendent une donnée
 * personnelle à un membre de l'équipe (export RGPD, pièces jointes).
 */
export function isCrossSiteRequest(headers: Headers): boolean {
  const site = headers.get("sec-fetch-site");
  return site !== null && site !== "same-origin" && site !== "none";
}
