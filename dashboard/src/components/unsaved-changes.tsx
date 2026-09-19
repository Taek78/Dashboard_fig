"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Save, TriangleAlert } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";

/*
 * Modifications NON ENREGISTRÉES (demande du 2026-09-18) : fiche d'un membre
 * de l'équipe, d'un produit, note d'un client. Dès qu'un champ du formulaire
 * change (événements input / change), quitter la page demande confirmation :
 * - un lien de l'application (menu, fil, carte, notification…) : la fenêtre
 *   « Modifications non enregistrées » propose « Enregistrer les
 *   modifications » (envoie le formulaire, puis part vers la page demandée
 *   si l'enregistrement réussit ; reste sur place et montre l'erreur sinon)
 *   ou « Quitter » (part sans enregistrer) ; Échap reste sur la page ;
 * - fermer l'onglet, recharger, aller sur un autre site : la boîte du
 *   navigateur (beforeunload ; son texte n'est pas personnalisable).
 * Le clic est intercepté à la capture, sur window, avant le routeur de Next :
 * App Router n'offre pas de garde de navigation. Un lien vers la même page,
 * un nouvel onglet ou un autre site n'est pas retenu. Enregistrement réussi :
 * plus rien à protéger. Le bouton « Précédent » du navigateur n'est pas
 * intercepté (limite connue).
 */
export function useUnsavedChanges(result: ActionResult): {
  formRef: React.RefObject<HTMLFormElement | null>;
  dialog: ReactNode;
} {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [dirty, setDirty] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [seen, setSeen] = useState(result);
  // La page où aller une fois l'enregistrement réussi (« Enregistrer »).
  const [goTo, setGoTo] = useState<string | null>(null);

  // Un nouvel état de l'action (ajusté au rendu) : réussi, plus rien à
  // protéger, et départ vers la page demandée si c'était « Enregistrer » ;
  // en échec, on reste sur la page et l'erreur du formulaire se voit.
  if (seen !== result) {
    setSeen(result);
    if (result.status === "success") setDirty(false);
    if (saving) {
      setSaving(false);
      if (result.status === "success" && target) setGoTo(target);
      setTarget(null);
    }
  }
  useEffect(() => {
    if (goTo) router.push(goTo);
  }, [goTo, router]);

  // Une modification dans le formulaire.
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const mark = () => setDirty(true);
    form.addEventListener("input", mark);
    form.addEventListener("change", mark);
    return () => {
      form.removeEventListener("input", mark);
      form.removeEventListener("change", mark);
    };
  }, []);

  // Tant qu'il y a des modifications : liens retenus, onglet protégé.
  useEffect(() => {
    if (!dirty) return;
    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setTarget(`${url.pathname}${url.search}${url.hash}`);
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("click", onClick, true);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [dirty]);

  function save() {
    const form = formRef.current;
    if (!form) return;
    // Champ obligatoire vide ou invalide : on reste, le navigateur le montre.
    if (!form.checkValidity()) {
      setTarget(null);
      form.reportValidity();
      return;
    }
    setSaving(true);
    form.requestSubmit();
  }

  function leave() {
    const href = target;
    setDirty(false);
    setTarget(null);
    if (href) router.push(href);
  }

  const dialog = (
    <AlertDialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open && !saving) setTarget(null);
      }}
    >
      <AlertDialogContent>
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="bg-warning/15 text-warning flex size-11 shrink-0 items-center justify-center rounded-full"
          >
            <TriangleAlert className="size-5" />
          </span>
          <div className="flex min-w-0 flex-col gap-1.5">
            <AlertDialogTitle>Modifications non enregistrées</AlertDialogTitle>
            <AlertDialogDescription>
              Vous avez modifié cette fiche. Les modifications seront perdues si
              vous quittez sans enregistrer.
            </AlertDialogDescription>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={leave}
            disabled={saving}
          >
            Quitter
          </Button>
          <Button
            type="button"
            variant="brand"
            onClick={save}
            disabled={saving}
          >
            <Save />
            {saving ? "Enregistrement…" : "Enregistrer les modifications"}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { formRef, dialog };
}
