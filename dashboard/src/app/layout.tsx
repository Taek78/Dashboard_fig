import type { Metadata } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
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
 * Mode d'affichage : le script inline lit localStorage et pose data-theme sur
 * <html> AVANT le premier rendu, pour éviter un flash clair sur un utilisateur en
 * sombre. Le serveur ne connaît pas ce choix : suppressHydrationWarning limite
 * l'avertissement à cet attribut.
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${plusJakarta.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
