import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Carrot, Leaf, ShieldCheck, Truck } from "lucide-react";
import { auth } from "@/auth";
import { LoginForm } from "@/components/auth/login-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/*
 * Page de connexion, hors du groupe (dashboard) : pas de sidebar. Un utilisateur
 * déjà connecté est renvoyé à l'accueil.
 *
 * Deux panneaux sur grand écran : à gauche la marque (dégradé, logo qui flotte
 * doucement, trois promesses du produit), à droite la carte de connexion. Sur
 * mobile, seule la carte reste, avec le logo au-dessus.
 */
export const metadata: Metadata = { title: "Connexion" };

const PROMISES = [
  { icon: Truck, text: "La tournée du jour, prête à être livrée." },
  { icon: Leaf, text: "Le catalogue de saison, à jour en un geste." },
  {
    icon: ShieldCheck,
    text: "Chaque action vérifiée, chaque changement tracé.",
  },
] as const;

export default async function ConnexionPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <main className="relative flex flex-1 items-center justify-center p-4 md:p-8">
      <ThemeToggle className="absolute top-4 right-4 z-10" />
      <div className="bg-card ring-foreground/10 grid w-full max-w-4xl overflow-hidden rounded-3xl shadow-xl ring-1 lg:grid-cols-[1.1fr_1fr]">
        <section
          aria-label="FIG Back-office"
          className="bg-gradient-brand relative hidden flex-col justify-between p-10 text-white lg:flex"
        >
          <div
            aria-hidden="true"
            className="absolute -top-24 -right-24 size-72 rounded-full bg-white/15 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-32 -left-16 size-80 rounded-full bg-black/10 blur-3xl"
          />
          <div className="relative flex items-center gap-3">
            <span className="float-soft flex size-14 items-center justify-center rounded-2xl bg-white/20 shadow-lg ring-1 ring-white/30 backdrop-blur">
              <Carrot className="size-7" aria-hidden="true" />
            </span>
            <span className="text-2xl font-bold tracking-tight">FIG</span>
          </div>
          <div className="relative flex flex-col gap-6">
            <p className="text-3xl leading-tight font-semibold text-balance">
              Le back-office des fruits et légumes livrés chez vos clients.
            </p>
            <ul className="flex flex-col gap-3 text-sm text-white/90">
              {PROMISES.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/25">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
          <p className="relative text-xs text-white/70">
            Accès réservé à l&apos;équipe FIG.
          </p>
        </section>

        <Card className="rounded-none border-0 shadow-none ring-0">
          <CardHeader className="items-center pt-6 text-center lg:items-start lg:text-left">
            <div
              aria-hidden="true"
              className="bg-gradient-brand mb-3 flex size-12 items-center justify-center rounded-2xl text-white shadow-md lg:hidden"
            >
              <Carrot className="size-6" />
            </div>
            <CardTitle>
              <h1 className="text-2xl font-semibold tracking-tight">
                Bienvenue
              </h1>
            </CardTitle>
            <p className="text-muted-foreground text-sm">
              Connectez-vous avec votre compte d&apos;équipe.
            </p>
          </CardHeader>
          <CardContent className="pb-6">
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
