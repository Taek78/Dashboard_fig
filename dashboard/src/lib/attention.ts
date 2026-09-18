/*
 * Attirer l'attention quand le back-office n'est PAS au premier plan
 * (demande du 2026-09-18 : sur ordinateur, que la barre des tâches signale
 * une nouveauté). Trois moyens, du plus fort au plus discret :
 * - une notification SYSTÈME (Notification API) : sous Windows, la bulle du
 *   centre de notifications, avec l'icône du navigateur ; permission demandée
 *   une fois, au premier geste sur un ordinateur (desktopPermission) ;
 * - le compte dans le TITRE de l'onglet, « (3) Tableau de bord · FIG », lu
 *   dans l'aperçu de la barre des tâches et dans l'onglet ;
 * - le BADGE de l'icône de l'application (Badging API), là où le navigateur
 *   le permet (application installée).
 * Tout s'efface au retour sur l'onglet. Les deux fonctions pures du titre
 * sont testées ; le reste touche au navigateur et ne fait rien ailleurs.
 */
const COUNT_PREFIX = /^\(\d+\+?\) /;

/** « Tableau de bord » + 3 → « (3) Tableau de bord » ; 0 retire le compte ; 99+ au-delà. */
export function titleWithCount(title: string, count: number): string {
  const base = title.replace(COUNT_PREFIX, "");
  if (count <= 0) return base;
  return `(${count > 99 ? "99+" : count}) ${base}`;
}

/** Vrai si la page n'est pas sous les yeux : onglet caché ou fenêtre sans focus. */
export function isAway(): boolean {
  return document.visibilityState !== "visible" || !document.hasFocus();
}

/** Un ordinateur : pointeur précis et écran large (pas un téléphone ni une tablette). */
export function isDesktop(): boolean {
  return window.matchMedia("(pointer: fine) and (min-width: 1024px)").matches;
}

/**
 * Demande la permission des notifications système, une seule fois, sur un
 * ordinateur. À appeler depuis un geste de la personne (sinon le navigateur
 * ignore ou masque la demande).
 */
export function desktopPermission(): void {
  if (!("Notification" in window) || !isDesktop()) return;
  if (Notification.permission === "default") {
    void Notification.requestPermission();
  }
}

/** Notification système (si permise) ; un clic ramène sur l'onglet et appelle `onOpen`. */
export function notifyDesktop(
  title: string,
  body: string,
  onOpen: () => void,
): void {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }
  // tag : une nouvelle notification REMPLACE la précédente, jamais d'empilement.
  const notification = new Notification(`FIG · ${title}`, {
    body,
    tag: "fig-alertes",
  });
  notification.onclick = () => {
    window.focus();
    onOpen();
    notification.close();
  };
}

/** Compte des nouveautés vues de loin : titre de l'onglet et badge de l'icône. */
export function showAttention(count: number): void {
  document.title = titleWithCount(document.title, count);
  const nav = navigator as Navigator & {
    setAppBadge?: (n: number) => Promise<void>;
  };
  nav.setAppBadge?.(count).catch(() => {});
}

export function clearAttention(): void {
  document.title = titleWithCount(document.title, 0);
  const nav = navigator as Navigator & { clearAppBadge?: () => Promise<void> };
  nav.clearAppBadge?.().catch(() => {});
}
