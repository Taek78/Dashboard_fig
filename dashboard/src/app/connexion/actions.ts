"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { loginSchema } from "@/domain/auth/schemas";
import type { ActionResult } from "@/lib/action-result";

/*
 * Actions de connexion et de déconnexion. signIn() redirige en cas de succès en
 * levant une exception interne de Next (NEXT_REDIRECT) : on ne l'attrape pas, on
 * relance tout ce qui n'est pas une AuthError. Message d'échec unique : ne jamais
 * dire si c'est l'e-mail ou le mot de passe qui est faux.
 */
const MESSAGES = {
  invalid: "Saisissez un e-mail valide et un mot de passe.",
  failed: "E-mail ou mot de passe incorrect.",
} as const;

export async function login(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", message: MESSAGES.invalid };
  }
  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/",
    });
    return { status: "success", message: "Connexion réussie." };
  } catch (error) {
    if (error instanceof AuthError) {
      return { status: "error", message: MESSAGES.failed };
    }
    throw error;
  }
}

export async function logout(): Promise<void> {
  await signOut({ redirectTo: "/connexion" });
}
