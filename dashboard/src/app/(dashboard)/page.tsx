import { ComingSoon } from "@/components/coming-soon";
import { PageHeader } from "@/components/page-header";

/*
 * Tableau de bord, route « / ». Le groupe (dashboard) n'apparaît pas dans l'URL :
 * il partage le layout avec sidebar. Pas de metadata : le titre par défaut suffit.
 * A6 : cartes KPI et graphiques.
 */
export default function TableauDeBordPage() {
  return (
    <>
      <PageHeader
        title="Tableau de bord"
        description="Vue d'ensemble de l'activité du jour."
      />
      <ComingSoon feature="Le tableau de bord" />
    </>
  );
}
