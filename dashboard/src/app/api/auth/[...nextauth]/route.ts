import { handlers } from "@/auth";

/* Points d'entrée HTTP d'Auth.js (/api/auth/*) : connexion, déconnexion, session, CSRF. */
export const { GET, POST } = handlers;
