import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@/app/globals.css";

/*
 * Layout racine : <html>, polices, métadonnées par défaut. Rien de visuel ici.
 *
 * Pourquoi la coquille (sidebar, en-tête) n'est PAS dans ce fichier : elle vit dans
 * src/app/(dashboard)/layout.tsx. Le jour où une page hors coquille arrive
 * (/connexion en A7), elle se place à côté du groupe (dashboard) et hérite de ce
 * layout racine sans la sidebar.
 *
 * title.template s'applique aux pages enfants (« Commandes · FIG Back-office »),
 * default sert aux pages sans titre. lang="fr" pilote la voix des lecteurs d'écran.
 */
const geistSans = Geist({
  variable: "--font-geist-sans",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
