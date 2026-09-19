"use client";

import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/*
 * Champ mot de passe avec un bouton ŒIL (demande du 2026-09-18), sans texte :
 * œil ouvert tant que le mot de passe est masqué (le montrer), œil barré
 * quand il est visible (le cacher). Bouton bascule : nom accessible constant
 * « Voir le mot de passe » et état dit par aria-pressed, comme le recommande
 * l'ARIA pour un bouton à deux états. Les deux icônes sont superposées et
 * basculent l'une vers l'autre (rotation, échelle, fondu, `motion-safe:`).
 * Le bouton est de type « button » : il n'envoie jamais le formulaire.
 */
export function PasswordInput({
  className,
  ...props
}: Omit<ComponentProps<typeof Input>, "type">) {
  const [visible, setVisible] = useState(false);
  const swap = (shown: boolean) =>
    cn(
      "col-start-1 row-start-1 size-4 motion-safe:transition-[scale,rotate,opacity] motion-safe:duration-200",
      shown
        ? "scale-100 rotate-0 opacity-100"
        : "scale-50 -rotate-45 opacity-0",
    );

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        className={cn("pr-10", className)}
      />
      <button
        type="button"
        aria-label="Voir le mot de passe"
        aria-pressed={visible}
        aria-controls={props.id}
        title={visible ? "Masquer le mot de passe" : "Voir le mot de passe"}
        onClick={() => setVisible((v) => !v)}
        className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/50 absolute top-1/2 right-1 grid size-7 -translate-y-1/2 place-items-center rounded-none outline-none focus-visible:ring-3 motion-safe:transition-[color,background-color,scale] motion-safe:active:scale-90"
      >
        <Eye aria-hidden="true" className={swap(!visible)} />
        <EyeOff aria-hidden="true" className={swap(visible)} />
      </button>
    </div>
  );
}
