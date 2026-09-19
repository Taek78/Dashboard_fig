/*
 * Badge « Nouveau » des cartes (demande du 2026-09-18) : les commandes et
 * messages arrivés pendant la session, repérés par le relevé des alertes.
 * Règles :
 * - une nouveauté reste marquée FRESH_MS (1 minute) après son arrivée ;
 * - ouvrir son détail (/commandes/[id], /messages/[id]) l'éteint aussitôt ;
 * - au RECHARGEMENT de la page, elle ne s'éteint que si l'on était entré
 *   dans sa section (Commandes ou Messages) depuis son arrivée ; sinon elle
 *   reste marquée, dans la limite de sa minute.
 * État de l'onglet : sessionStorage (une préférence de confort, jamais
 * partagée, jamais relue par le serveur), protégé par try/catch (navigation
 * privée, stockage bloqué : rien ne casse, le badge vit alors en mémoire).
 * Les fonctions pures sont testées ; le reste touche au navigateur.
 */
export const FRESH_MS = 60_000;
export const FRESH_KINDS = ["orders", "messages"] as const;
export type FreshKind = (typeof FRESH_KINDS)[number];

/** Une nouveauté : son arrivée, et si sa section a été ouverte depuis. */
export type FreshEntry = { at: number; entered: boolean };
export type FreshState = Record<FreshKind, Record<string, FreshEntry>>;

export const EMPTY_FRESH: FreshState = { orders: {}, messages: {} };

/** Encore marquée à l'instant `now` ? */
export function isFresh(entry: FreshEntry | undefined, now: number): boolean {
  return entry !== undefined && now - entry.at < FRESH_MS;
}

/** Au chargement de la page : sans les expirées, ni celles dont la section a été ouverte. */
export function afterReload(state: FreshState, now: number): FreshState {
  const keep = (entries: Record<string, FreshEntry>) =>
    Object.fromEntries(
      Object.entries(entries).filter(
        ([, entry]) => !entry.entered && isFresh(entry, now),
      ),
    );
  return { orders: keep(state.orders), messages: keep(state.messages) };
}

export function withFresh(
  state: FreshState,
  kind: FreshKind,
  ids: readonly string[],
  at: number,
): FreshState {
  if (ids.length === 0) return state;
  const added = Object.fromEntries(
    ids.map((id) => [id, { at, entered: false } satisfies FreshEntry]),
  );
  return { ...state, [kind]: { ...state[kind], ...added } };
}

/** La section a été ouverte : ses nouveautés s'éteindront au prochain rechargement. */
export function withEntered(state: FreshState, kind: FreshKind): FreshState {
  const entries = state[kind];
  if (Object.values(entries).every((entry) => entry.entered)) return state;
  return {
    ...state,
    [kind]: Object.fromEntries(
      Object.entries(entries).map(([id, entry]) => [
        id,
        { ...entry, entered: true },
      ]),
    ),
  };
}

/** Le détail a été ouvert : la nouveauté s'éteint. */
export function withoutFresh(
  state: FreshState,
  kind: FreshKind,
  id: string,
): FreshState {
  if (!(id in state[kind])) return state;
  const { [id]: _removed, ...rest } = state[kind];
  void _removed;
  return { ...state, [kind]: rest };
}

/* ---------- Navigateur : l'état de l'onglet et ses abonnés ---------- */

const STORAGE_KEY = "fig:nouveautes";
const CHANGE_EVENT = "fig:nouveautes-change";
let current: FreshState | null = null;

function read(): FreshState {
  if (current) return current;
  let stored: FreshState = EMPTY_FRESH;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw) stored = { ...EMPTY_FRESH, ...(JSON.parse(raw) as FreshState) };
  } catch {
    stored = EMPTY_FRESH;
  }
  // Premier accès depuis le chargement de la page : la règle du rechargement.
  current = afterReload(stored, Date.now());
  write(current);
  return current;
}

function write(state: FreshState): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Stockage indisponible : l'état reste en mémoire pour cette page.
  }
}

function update(next: (state: FreshState) => FreshState): void {
  const before = read();
  const after = next(before);
  if (after === before) return;
  current = after;
  write(after);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function getFreshState(): FreshState {
  return read();
}

/** État côté serveur (useSyncExternalStore) : aucune nouveauté. */
export function getServerFreshState(): FreshState {
  return EMPTY_FRESH;
}

export function subscribeFresh(listener: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, listener);
  return () => window.removeEventListener(CHANGE_EVENT, listener);
}

export function addFresh(kind: FreshKind, ids: readonly string[]): void {
  update((state) => withFresh(state, kind, ids, Date.now()));
}

export function enterFreshSection(kind: FreshKind): void {
  update((state) => withEntered(state, kind));
}

export function openFresh(kind: FreshKind, id: string): void {
  update((state) => withoutFresh(state, kind, id));
}
