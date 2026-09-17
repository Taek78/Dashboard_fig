import "server-only";
import { createHash } from "node:crypto";
import { getEnv } from "@/lib/env";

/*
 * Vérification d'un mot de passe contre les fuites connues, par l'API
 * k-anonymity de Have I Been Pwned : seuls les 5 premiers caractères du SHA-1
 * du mot de passe quittent le serveur, l'API renvoie tous les suffixes qui
 * commencent ainsi (plusieurs centaines), et la comparaison se fait ici. Ni le
 * mot de passe, ni son hachage complet, ni l'identité de la personne ne sont
 * transmis ; « Add-Padding » masque même le nombre de lignes de la réponse.
 *
 * Renvoie true (compromis), false (inconnu des fuites) ou null (API
 * injoignable : la politique accepte alors le mot de passe, en le signalant,
 * plutôt que de bloquer tout changement pendant une panne externe).
 * PASSWORD_BREACH_CHECK=0 désactive l'appel (suite navigateur, poste sans réseau).
 */
const ENDPOINT = "https://api.pwnedpasswords.com/range/";
const TIMEOUT_MS = 4_000;

export async function isPasswordPwned(
  password: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean | null> {
  if (getEnv().PASSWORD_BREACH_CHECK === "0") return false;
  const sha1 = createHash("sha1").update(password, "utf8").digest("hex");
  const prefix = sha1.slice(0, 5).toUpperCase();
  const suffix = sha1.slice(5).toUpperCase();
  try {
    const response = await fetchImpl(`${ENDPOINT}${prefix}`, {
      headers: { "Add-Padding": "true", "User-Agent": "fig-dashboard" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const body = await response.text();
    return body.split(/\r?\n/).some((line) => {
      const [hash, count] = line.trim().split(":");
      return hash === suffix && Number(count) > 0;
    });
  } catch {
    return null;
  }
}
