import type { CSSProperties, ReactNode } from "react";
import { Carrot } from "lucide-react";
import { LoginScene } from "@/components/auth/login-scene";
import { ThemeToggle } from "@/components/theme-toggle";

/*
 * Coquille des pages hors session (connexion, mot de passe oublié, adresse
 * oubliée, invitation, verrouillage) : la SCÈNE abstraite plein écran
 * (LoginScene : parallaxe au pointeur) sur le fond de la fenêtre, un balayage
 * de dégradé très lent, le motif verger qui respire, trois orbes de lumière
 * aux couleurs du thème, le mot FIG en filigrane et quelques particules qui
 * montent. Au centre, la carte en verre qui entre en fondu : logo, marque,
 * titre de la page, sous-titre, puis le contenu. Aucun faux contenu. Tout est
 * en tokens et en animations CSS sur transform et opacity ; immobile pour qui
 * refuse le mouvement (globals.css, « Connexion »).
 */

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

export function LoginShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
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

      {/* Carte en verre assez transparente pour laisser voir la scène (demande du 2026-09-17) : fond à 55 %, 35 % quand le flou d'arrière-plan est disponible, flou moyen pour garder le texte lisible. */}
      <div className="login-card bg-card/55 supports-backdrop-filter:bg-card/35 ring-foreground/15 relative w-full max-w-md rounded-3xl p-6 shadow-2xl ring-1 backdrop-blur-md md:p-8">
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
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          {subtitle ? (
            <p className="text-muted-foreground text-sm text-balance">
              {subtitle}
            </p>
          ) : null}
        </div>
        {children}
        {footer ? (
          <div className="text-muted-foreground mt-6 flex flex-col items-center gap-2 text-center text-xs">
            {footer}
          </div>
        ) : null}
      </div>
    </LoginScene>
  );
}
