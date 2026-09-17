"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * Scène de la page de connexion (client : un seul effet). Le pointeur décale
 * légèrement les couches décoratives en parallaxe : sa position, ramenée de
 * -1 à 1, est écrite dans les variables CSS --px / --py de la scène ; chaque
 * couche en fait sa propre translation (globals.css, « Connexion »). Une
 * image par trame au plus (requestAnimationFrame), rien si l'utilisateur
 * refuse le mouvement ou sur un écran tactile (pas de pointeur qui survole).
 * Les animations elles-mêmes sont en CSS : sans JavaScript, la scène vit
 * quand même, seule la parallaxe manque.
 */
export function LoginScene({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const scene = ref.current;
    if (!scene) return;
    const still =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      window.matchMedia("(hover: none)").matches;
    if (still) return;

    let frame = 0;
    const move = (event: PointerEvent) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const x = (event.clientX / window.innerWidth) * 2 - 1;
        const y = (event.clientY / window.innerHeight) * 2 - 1;
        scene.style.setProperty("--px", x.toFixed(3));
        scene.style.setProperty("--py", y.toFixed(3));
      });
    };
    const rest = () => {
      scene.style.setProperty("--px", "0");
      scene.style.setProperty("--py", "0");
    };
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", rest);
    return () => {
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", rest);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <main ref={ref} className={cn("login-scene", className)}>
      {children}
    </main>
  );
}
