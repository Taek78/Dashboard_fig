/*
 * Enveloppe remontée à CHAQUE navigation (contrairement au layout, rendu une
 * fois) : c'est le bon endroit pour l'entrée de page. `page-in` fond et
 * glisse légèrement le contenu, seulement si l'utilisateur accepte le
 * mouvement (prefers-reduced-motion).
 */
export default function DashboardTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="page-in flex flex-1 flex-col gap-6">{children}</div>;
}
