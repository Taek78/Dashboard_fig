import { z } from "zod";

/* Entrée du formulaire de connexion : validée avant toute recherche de compte. */
export const loginSchema = z.object({
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(1).max(200),
});
