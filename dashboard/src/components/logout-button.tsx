"use client";

import { useFormStatus } from "react-dom";
import { Power } from "lucide-react";
import { logout } from "@/app/connexion/actions";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/*
 * Déconnexion (demande du 2026-09-18) : le symbole universel marche / arrêt
 * (le 1 dans le 0), rond, en haut à droite du bandeau. Au survol ou au focus
 * clavier, le bouton s'allume en rouge (--destructive) et une onde s'en
 * échappe ; il s'enfonce au clic. Toutes les animations sont `motion-safe:` :
 * rien ne bouge si le poste demande moins d'animations.
 *
 * Il ouvre une CONFIRMATION (« Voulez-vous vraiment vous déconnecter ? ») :
 * « Oui » envoie le formulaire vers la Server Action logout, « Non » (ou
 * Échap) referme sans rien faire. Sans JavaScript, la boîte ne peut pas
 * s'ouvrir : un formulaire de secours direct est rendu dans <noscript>.
 */
function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      {pending ? "Déconnexion…" : "Oui, me déconnecter"}
    </Button>
  );
}

const TRIGGER =
  "group text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/40 focus-visible:text-destructive focus-visible:ring-destructive/30 relative inline-flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors outline-none focus-visible:ring-3 motion-safe:active:scale-90 motion-safe:transition-[color,background-color,border-color,scale]";

export function LogoutButton() {
  return (
    <>
      <AlertDialog>
        <AlertDialogTrigger
          aria-label="Se déconnecter"
          title="Se déconnecter"
          className={TRIGGER}
        >
          <span
            aria-hidden="true"
            className="border-destructive/50 absolute inset-0 rounded-full border opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 motion-safe:group-hover:animate-ping motion-safe:group-focus-visible:animate-ping"
          />
          <Power
            aria-hidden="true"
            className="size-4 motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-110 motion-safe:group-hover:-rotate-12"
          />
        </AlertDialogTrigger>
        <AlertDialogContent>
          <div className="flex items-start gap-4">
            <span
              aria-hidden="true"
              className="bg-destructive/10 text-destructive flex size-11 shrink-0 items-center justify-center rounded-full"
            >
              <Power className="size-5 motion-safe:animate-pulse" />
            </span>
            <div className="flex flex-col gap-1.5">
              <AlertDialogTitle>
                Voulez-vous vraiment vous déconnecter ?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Votre session sera fermée sur cet appareil. Il faudra saisir de
                nouveau votre adresse e-mail et votre mot de passe.
              </AlertDialogDescription>
            </div>
          </div>
          <form
            action={logout}
            className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
          >
            <AlertDialogClose
              render={<Button type="button" variant="outline" />}
            >
              Non, rester connecté
            </AlertDialogClose>
            <ConfirmButton />
          </form>
        </AlertDialogContent>
      </AlertDialog>
      <noscript>
        <form action={logout}>
          <button type="submit" className={TRIGGER}>
            <Power aria-hidden="true" className="size-4" />
            <span className="sr-only">Se déconnecter</span>
          </button>
        </form>
      </noscript>
    </>
  );
}
