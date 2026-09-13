import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Carrot } from "lucide-react";
import { auth } from "@/auth";
import { LoginForm } from "@/components/auth/login-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/*
 * Page de connexion, hors du groupe (dashboard) : pas de sidebar. Un utilisateur
 * déjà connecté est renvoyé à l'accueil.
 */
export const metadata: Metadata = { title: "Connexion" };

export default async function ConnexionPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <main className="relative flex flex-1 items-center justify-center p-4">
      <ThemeToggle className="absolute top-4 right-4" />
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div
            aria-hidden="true"
            className="bg-gradient-brand mx-auto mb-2 flex size-12 items-center justify-center rounded-xl text-white shadow-sm"
          >
            <Carrot className="size-6" />
          </div>
          <CardTitle>
            <h1 className="text-lg font-semibold">FIG Back-office</h1>
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            Connectez-vous avec votre compte d&apos;équipe.
          </p>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
