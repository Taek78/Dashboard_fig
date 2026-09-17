import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "@/components/auth/login-form";
import { LoginShell } from "@/components/auth/login-shell";

/*
 * Page de connexion, hors du groupe (dashboard) : pas de sidebar. Un utilisateur
 * déjà connecté est renvoyé à l'accueil. La scène animée et la carte en verre
 * sont dans LoginShell, partagée avec les pages de récupération.
 */
export const metadata: Metadata = { title: "Connexion" };

export default async function ConnexionPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <LoginShell
      title="Bienvenue"
      subtitle="Connectez-vous avec votre compte d'équipe."
      footer="Accès réservé à l'équipe FIG."
    >
      <LoginForm />
    </LoginShell>
  );
}
