/*
 * Sons des alertes en direct (demande du 2026-09-18), synthétisés par le
 * Web Audio API. Aucun fichier son, aucune
 * dépendance, rien à charger.
 *
 * Les navigateurs interdisent le son tant que la personne n'a pas interagi
 * avec la page (clic, touche) : unlockChime() crée le contexte audio au
 * premier geste. Sans ce geste, les sons ne jouent pas, sans erreur.
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
 * DEUX signatures sonores (2026-09-18), ORIGINALES, jamais la copie d'un son
 * de marque, pour qu'on sache sans regarder ce qui arrive :
 * - COMMANDE (« professionnel et moderne », dans l'esprit des applications
 *   de livraison) : trois notes pincées et brillantes qui MONTENT (sol-do-mi,
 *   façon marimba), jouées TROIS fois d'affilée à 0,7 s pour que l'alerte
 *   dure et se fasse entendre dans une cuisine ou un entrepôt (demande du
 *   2026-09-19) ; environ 2,1 s ;
 * - MESSAGE : deux notes douces qui DESCENDENT (ré-la), jouées DEUX fois
 *   d'affilée à 0,75 s, plus bas en volume, façon message de discussion ;
 *   environ 1,4 s.
 * Même timbre (attaque nette, extinction rapide, sinusoïde et harmonique
 * d'octave) et même léger écho : une seule identité sonore. Une sonnerie par
 * relevé ; si commandes et messages arrivent ensemble, la commande l'emporte.
 * Ce que chaque compte entend suit son rôle et ses préférences (« Mon
 * profil ») : le relevé ne lui renvoie que ce qu'il doit recevoir.
 */
export type ChimePattern = {
  notesHz: readonly number[];
  repeats: number;
  noteGapS: number;
  noteLengthS: number;
  repeatGapS: number;
  peakGain: number;
};

export const ORDER_CHIME: ChimePattern = {
  notesHz: [783.99, 1046.5, 1318.51],
  repeats: 3,
  noteGapS: 0.09,
  noteLengthS: 0.45,
  repeatGapS: 0.7,
  peakGain: 0.22,
};

export const MESSAGE_CHIME: ChimePattern = {
  notesHz: [1174.66, 880],
  repeats: 2,
  noteGapS: 0.13,
  noteLengthS: 0.5,
  repeatGapS: 0.75,
  peakGain: 0.15,
};

/** L'harmonique d'octave, plus discrète : le timbre « pincé ». */
const OVERTONE_GAIN = 0.35;
const ECHO_DELAY_S = 0.16;
const ECHO_FEEDBACK = 0.22;

/** Durée d'un motif, en secondes (hors traîne de l'écho). */
export function chimeDuration(pattern: ChimePattern): number {
  return (
    (pattern.repeats - 1) * pattern.repeatGapS +
    (pattern.notesHz.length - 1) * pattern.noteGapS +
    pattern.noteLengthS
  );
}

/** Une note pincée : fondamentale et octave, attaque de 5 ms, extinction exponentielle. */
function pluck(
  audio: AudioContext,
  output: AudioNode,
  frequency: number,
  at: number,
  pattern: ChimePattern,
): void {
  for (const [ratio, level] of [
    [1, 1],
    [2, OVERTONE_GAIN],
  ] as const) {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency * ratio, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(
      pattern.peakGain * level,
      at + 0.005,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, at + pattern.noteLengthS);
    oscillator.connect(gain).connect(output);
    oscillator.start(at);
    oscillator.stop(at + pattern.noteLengthS + 0.05);
  }
}

function playPattern(pattern: ChimePattern): void {
  if (context === null || context.state !== "running") return;
  const audio = context;
  const start = audio.currentTime;
  // Sortie commune et écho léger (retard réinjecté), pour l'espace.
  const bus = audio.createGain();
  const echo = audio.createDelay(1);
  const feedback = audio.createGain();
  echo.delayTime.value = ECHO_DELAY_S;
  feedback.gain.value = ECHO_FEEDBACK;
  bus.connect(audio.destination);
  bus.connect(echo);
  echo.connect(feedback).connect(echo);
  echo.connect(audio.destination);
  for (let repeat = 0; repeat < pattern.repeats; repeat += 1) {
    pattern.notesHz.forEach((frequency, index) => {
      pluck(
        audio,
        bus,
        frequency,
        start + repeat * pattern.repeatGapS + index * pattern.noteGapS,
        pattern,
      );
    });
  }
  // L'écho se tait après la dernière note : le graphe est libéré.
  setTimeout(
    () => {
      bus.disconnect();
      echo.disconnect();
      feedback.disconnect();
    },
    (chimeDuration(pattern) + 1.5) * 1000,
  );
}

/** Nouvelle commande. */
export function playOrderChime(): void {
  playPattern(ORDER_CHIME);
}

/** Nouveau message client. */
export function playMessageChime(): void {
  playPattern(MESSAGE_CHIME);
}
