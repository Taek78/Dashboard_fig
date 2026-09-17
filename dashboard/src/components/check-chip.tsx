import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * Case à cocher d'un filtre, habillée en puce (serveur) : à la hauteur des
 * listes déroulantes, la case native reste visible dans la puce (clic,
 * clavier et lecteurs d'écran passent par elle) et la puce se colore quand
 * elle est cochée. `accent="destructive"` pour un signalement (messages
 * importants).
 */
export function CheckChip({
  id,
  name,
  value,
  defaultChecked,
  accent = "primary",
  className,
  children,
}: {
  id: string;
  name: string;
  value: string;
  defaultChecked?: boolean;
  accent?: "primary" | "destructive";
  className?: string;
  children: ReactNode;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "bg-card border-input hover:bg-muted/40 has-focus-visible:ring-ring/50 inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors select-none has-focus-visible:ring-3",
        accent === "destructive"
          ? "has-checked:border-destructive/40 has-checked:bg-destructive/10 has-checked:text-destructive"
          : "has-checked:border-primary/40 has-checked:bg-primary/10 has-checked:text-primary",
        className,
      )}
    >
      <input
        id={id}
        name={name}
        type="checkbox"
        value={value}
        defaultChecked={defaultChecked}
        className={cn(
          "size-4 shrink-0",
          accent === "destructive" ? "accent-destructive" : "accent-primary",
        )}
      />
      {children}
    </label>
  );
}
