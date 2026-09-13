import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

/*
 * turbopack.root : le dossier utilisateur contient lui aussi un package-lock.json
 * et un dépôt git ; sans cette racine explicite, Next s'en inquiète à chaque
 * démarrage (« ignored package-lock.json in C:\Users\… »).
 */
const nextConfig: NextConfig = {
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) },
};

export default nextConfig;
