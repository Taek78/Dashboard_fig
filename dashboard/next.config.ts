import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

/*
 * turbopack.root : le dossier utilisateur contient lui aussi un package-lock.json
 * et un dépôt git ; sans cette racine explicite, Next s'en inquiète à chaque
 * démarrage (« ignored package-lock.json in C:\Users\… »).
 *
 * En-têtes de sécurité (audit du 2026-09-14), posés sur toutes les réponses :
 * - CSP : scripts et styles du site seulement (l'inline reste toléré : le script
 *   anti-flash du thème et les styles de recharts en ont besoin ; le passage à
 *   un nonce est noté au backlog), images https (illustrations du client),
 *   aucun cadre parent (frame-ancestors 'none' : pas de détournement de clic
 *   sur les actions), formulaires vers le site seulement ;
 * - HSTS : n'a d'effet qu'en HTTPS, ignoré en http://localhost ;
 * - X-Frame-Options doublonne frame-ancestors pour les vieux navigateurs.
 * En développement, Turbopack a besoin de 'unsafe-eval' et d'un WebSocket.
 */
const isDev = process.env.NODE_ENV === "development";

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
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
