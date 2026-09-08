/*
 * Tableau de bord, route « / ».
 *
 * Pourquoi le groupe de routes (dashboard) : le dossier n'apparaît pas dans l'URL,
 * il sert uniquement à partager le layout avec sidebar entre toutes les pages du
 * back-office (A1.4 : (dashboard)/layout.tsx). Les pages hors coquille (/connexion)
 * resteront en dehors du groupe.
 *
 * A1.4 : PageHeader + ComingSoon ; A6 : cartes KPI et graphiques.
 */
export default function TableauDeBordPage() {
  return <h1>Tableau de bord</h1>;
}
