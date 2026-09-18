"use client";

import { useRef, useState } from "react";
import { Check, DoorOpen } from "lucide-react";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/*
 * Case « Parti de l'entreprise » et date de sortie (demande du 2026-09-18).
 * COCHER la case ouvre une fenêtre de confirmation « Oui / Non » (focus sur
 * « Non », Échap referme) : la case ne se coche que sur « Oui », puis le champ
 * de date apparaît et prend le focus (sinon le focus revient sur la case).
 * DÉCOCHER se fait sans question et cache le champ, qui n'est alors plus
 * envoyé (le schéma ignorerait sa valeur de toute façon). Cochée, la date est
 * obligatoire, ici et dans le schéma zod, qui la refuse aussi avant la date
 * d'entrée.
 * La case est un BOUTON à rôle « checkbox », pas un <input> : après chaque
 * envoi, React réinitialise le formulaire, ce qui décocherait une case native
 * sans changer l'état ; la case affichée et la valeur envoyée (champ caché
 * departed=on) suivent donc le seul état React.
 */
export function DepartureField({
  departed: initialDeparted,
  leftAt,
  name,
}: {
  departed: boolean;
  leftAt: string | null;
  /** Nom de la personne, pour la question ; absent à la création. */
  name?: string;
}) {
  const [departed, setDeparted] = useState(initialDeparted);
  const [asking, setAsking] = useState(false);
  const boxRef = useRef<HTMLButtonElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);

  function confirm() {
    setDeparted(true);
    setAsking(false);
  }

  return (
    <div className="flex flex-col gap-3 @2xl/main:col-span-2">
      <div className="flex items-center gap-2">
        <button
          ref={boxRef}
          id="departed"
          type="button"
          role="checkbox"
          aria-checked={departed}
          onClick={() => (departed ? setDeparted(false) : setAsking(true))}
          className="border-input aria-checked:border-destructive aria-checked:bg-destructive focus-visible:ring-ring/50 flex size-4 shrink-0 items-center justify-center rounded-[4px] border text-white outline-none focus-visible:ring-3 motion-safe:transition-[background-color,border-color,scale] motion-safe:active:scale-90"
        >
          {departed ? <Check className="size-3.5" aria-hidden="true" /> : null}
        </button>
        <Label htmlFor="departed">Parti de l&apos;entreprise</Label>
        {departed ? <input type="hidden" name="departed" value="on" /> : null}
      </div>
      {departed ? (
        <div className="grid gap-1.5 @2xl/main:max-w-xs">
          <Label htmlFor="leftAt">Date de sortie</Label>
          <Input
            ref={dateRef}
            id="leftAt"
            name="leftAt"
            type="date"
            required
            defaultValue={leftAt ?? ""}
            className="dark:scheme-dark"
          />
        </div>
      ) : null}

      <AlertDialog open={asking} onOpenChange={setAsking}>
        {/* À la fermeture : la date si « Oui » l'a fait apparaître, sinon la case. */}
        <AlertDialogContent
          finalFocus={() => dateRef.current ?? boxRef.current}
        >
          <div className="flex items-start gap-4">
            <span
              aria-hidden="true"
              className="bg-destructive/10 text-destructive flex size-11 shrink-0 items-center justify-center rounded-full"
            >
              <DoorOpen className="size-5" />
            </span>
            <div className="flex min-w-0 flex-col gap-1.5">
              <AlertDialogTitle className="wrap-anywhere">
                {`Voulez-vous vraiment indiquer que ${name ?? "cette personne"} a quitté l'entreprise ?`}
              </AlertDialogTitle>
              <AlertDialogDescription>
                La personne ne sera plus proposée pour les commandes et passera
                dans le personnel parti. Son historique est conservé.
              </AlertDialogDescription>
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialogClose
              render={<Button type="button" variant="outline" />}
            >
              Non
            </AlertDialogClose>
            <Button type="button" variant="destructive" onClick={confirm}>
              Oui
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
