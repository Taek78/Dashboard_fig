/*
 * Son d'une nouvelle commande (demande du 2026-09-18) : un carillon
 * synthétisé par le Web Audio API. Aucun fichier son, aucune
 * dépendance, rien à charger.
 *
 * Les navigateurs interdisent le son tant que la personne n'a pas interagi
 * avec la page (clic, touche) : unlockChime() crée le contexte audio au
 * premier geste. Sans ce geste, playChime() ne fait rien, sans erreur.
 * Navigateur seulement : ce module n'est importé que par un composant client.
 */
let context: AudioContext | null = null;

/** À appeler depuis un geste de la personne (pointerdown, keydown). */
export function unlockChime(): void {
  if (typeof window === "undefined" || !("AudioContext" in window)) return;
  context ??= new AudioContext();
  if (context.state === "suspended") void context.resume();
}

/*
 * Arpège montant do-mi-sol-do joué DEUX fois (demande du 2026-09-18 : une
 * alerte plus longue), environ 2,3 s en tout ; onde triangle, plus riche
 * qu'une sinusoïde sans être agressive. Une seule sonnerie par relevé, qu'il
 * arrive une ou cinq commandes.
 */
export const CHIME_NOTES_HZ = [523.25, 659.25, 783.99, 1046.5] as const;
export const CHIME_REPEATS = 2;
const NOTE_GAP_S = 0.16;
const NOTE_LENGTH_S = 0.9;
/** Écart entre deux passages de l'arpège. */
const REPEAT_GAP_S = 1.05;
const PEAK_GAIN = 0.16;

/** Durée totale du carillon, en secondes. */
export const CHIME_DURATION_S =
  (CHIME_REPEATS - 1) * REPEAT_GAP_S +
  (CHIME_NOTES_HZ.length - 1) * NOTE_GAP_S +
  NOTE_LENGTH_S;

export function playChime(): void {
  if (context === null || context.state !== "running") return;
  const start = context.currentTime;
  for (let repeat = 0; repeat < CHIME_REPEATS; repeat += 1) {
    CHIME_NOTES_HZ.forEach((frequency, index) => {
      const at = start + repeat * REPEAT_GAP_S + index * NOTE_GAP_S;
      const oscillator = context!.createOscillator();
      const gain = context!.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(PEAK_GAIN, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + NOTE_LENGTH_S);
      oscillator.connect(gain).connect(context!.destination);
      oscillator.start(at);
      oscillator.stop(at + NOTE_LENGTH_S + 0.05);
    });
  }
}
