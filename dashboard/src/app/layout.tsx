import type { Metadata } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { headers } from "next/headers";
import Script from "next/script";
import "@/app/globals.css";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

/*
 * Layout racine : <html>, polices, métadonnées, initialisation du mode d'affichage.
 * Rien de visuel ici.
 *
 * La coquille (sidebar, en-tête) vit dans src/app/(dashboard)/layout.tsx ;
 * /connexion hérite de ce layout racine sans la sidebar.
 *
 * Polices : Plus Jakarta Sans (texte et titres) et Geist Mono (références,
 * montants), servies depuis le projet par next/font.
 *
 * Mode d'affichage : le script inline (next/script, beforeInteractive) lit
 * localStorage et pose data-theme sur <html> AVANT le premier rendu, pour éviter
 * un flash clair sur un utilisateur en sombre. Un <script> brut dans du JSX
 * déclenche un avertissement React ; next/script est la voie prévue. Le serveur ne connaît pas ce choix : suppressHydrationWarning limite
 * l'avertissement à cet attribut. Le nonce (posé par src/proxy.ts dans
 * l'en-tête x-nonce) autorise ce script inline sous la CSP sans 'unsafe-inline'.
 */
const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    template: "%s · FIG Back-office",
    default: "FIG Back-office",
  },
  description: "Back-office de gestion des commandes et livraisons FIG",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${plusJakarta.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* beforeInteractive : injecté dans le HTML initial, exécuté avant l'hydratation. */}
        <Script id="theme-init" strategy="beforeInteractive" nonce={nonce}>
          {THEME_INIT_SCRIPT}
        </Script>
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
