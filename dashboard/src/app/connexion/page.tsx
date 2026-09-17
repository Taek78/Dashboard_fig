import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Carrot } from "lucide-react";
import { auth } from "@/auth";
import { LoginForm } from "@/components/auth/login-form";
import { LoginScene } from "@/components/auth/login-scene";
import { ThemeToggle } from "@/components/theme-toggle";

/*
 * Page de connexion, hors du groupe (dashboard) : pas de sidebar. Un utilisateur
 * déjà connecté est renvoyé à l'accueil.
 *
 * Une SCÈNE abstraite plein écran (LoginScene : parallaxe au pointeur) sur le
 * fond de la fenêtre : un balayage de dégradé très lent, le motif verger qui
 * respire, trois orbes de lumière aux couleurs du thème (marque, particulier),
 * le mot FIG en filigrane et quelques particules qui montent. Au centre, la
 * carte de connexion en verre, qui entre en fondu, ses champs l'un après
 * l'autre. Aucun faux contenu : rien que la marque et le formulaire. Tout est
 * en tokens et en animations CSS sur transform et opacity ; immobile pour qui
 * refuse le mouvement (globals.css, « Connexion »).
 */
export const metadata: Metadata = { title: "Connexion" };

/** Particules : position en %, décalage et durée en secondes, fixés (pas d'aléa au rendu). */
const PARTICLES = [
  [8, 22, 0, 9],
  [16, 68, 1.5, 11],
  [27, 38, 3, 8],
  [36, 82, 0.8, 12],
  [44, 14, 2.2, 10],
  [58, 76, 4, 9],
  [66, 28, 1.1, 13],
  [74, 58, 2.8, 8],
  [83, 18, 0.4, 11],
  [90, 72, 3.6, 10],
  [52, 46, 5, 12],
  [12, 48, 2.5, 10],
] as const;

export default async function ConnexionPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <LoginScene className="relative flex flex-1 items-center justify-center p-4 md:p-8">
      <div aria-hidden="true" className="login-layer">
        <span className="login-sweep" />
        <span className="login-verger" />
        <span className="login-orb login-orb-1" />
        <span className="login-orb login-orb-2" />
        <span className="login-orb login-orb-3" />
        <span className="login-wordmark text-gradient-brand">FIG</span>
        {PARTICLES.map(([x, y, delay, duration]) => (
          <span
            key={`${x}-${y}`}
            className="login-particle"
            style={
              {
                left: `${x}%`,
                top: `${y}%`,
                "--delay": `${delay}s`,
                "--duration": `${duration}s`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <ThemeToggle className="absolute top-4 right-4 z-10" />

      <div className="login-card bg-card/85 supports-backdrop-filter:bg-card/70 ring-foreground/10 relative w-full max-w-md rounded-3xl p-6 shadow-2xl ring-1 backdrop-blur-xl md:p-8">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span
            aria-hidden="true"
            className="float-soft bg-gradient-brand flex size-14 items-center justify-center rounded-2xl text-white shadow-lg ring-1 ring-white/30"
          >
            <Carrot className="size-7" />
          </span>
          <span className="text-gradient-brand text-xs font-bold tracking-[0.22em] uppercase">
            FIG Back-office
          </span>
          <h1 className="text-3xl font-semibold tracking-tight">Bienvenue</h1>
          <p className="text-muted-foreground text-sm">
            Connectez-vous avec votre compte d&apos;équipe.
          </p>
        </div>
        <LoginForm />
        <p className="text-muted-foreground mt-6 text-center text-xs">
          Accès réservé à l&apos;équipe FIG.
        </p>
      </div>
    </LoginScene>
  );
}
