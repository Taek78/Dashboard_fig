import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

/*
 * turbopack.root : le dossier utilisateur contient lui aussi un package-lock.json
 * et un dépôt git ; sans cette racine explicite, Next s'en inquiète à chaque
 * démarrage (« ignored package-lock.json in C:\Users\… »).
 *
 * En-têtes de sécurité (audit du 2026-09-14), posés sur toutes les réponses.
 * La Content-Security-Policy n'est PAS ici : elle porte un nonce par requête,
 * donc c'est src/proxy.ts qui la pose (src/lib/csp.ts la construit).
 * - HSTS : n'a d'effet qu'en HTTPS, ignoré en http://localhost ;
 * - X-Frame-Options doublonne frame-ancestors (CSP) pour les vieux navigateurs.
 */
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
