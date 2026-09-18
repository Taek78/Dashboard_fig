/*
 * Pagination par CURSEUR des listes de l'API (règles pures) : une page se
 * demande « après tel élément » (instant, identifiant) et non par numéro. Une
 * liste qui bouge entre deux pages (nouvelle commande, nouveau message) ne
 * décale rien, et la base sert la page par un index composite au lieu de
 * sauter des lignes (OFFSET). Le curseur est opaque pour l'application :
 * base64url d'un JSON { at, id } ; invalide = ignoré (première page).
 */
export type KeysetCursor = { at: string; id: string };

/** Ce qu'une source reçoit : la taille et, après la première page, le dernier élément lu. */
export type KeysetPage = { limit: number; after: KeysetCursor | null };

/** Ce qu'une source renvoie : les éléments et le curseur de la page suivante, sinon null. */
export type KeysetResult<T> = { items: T[]; next: KeysetCursor | null };

export function encodeCursor(cursor: KeysetCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCursor(value: string | undefined): KeysetCursor | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    );
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as KeysetCursor).at === "string" &&
      typeof (parsed as KeysetCursor).id === "string" &&
      !Number.isNaN(Date.parse((parsed as KeysetCursor).at))
    ) {
      return {
        at: (parsed as KeysetCursor).at,
        id: (parsed as KeysetCursor).id,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Découpe `limit + 1` lignes lues par la base en une page : les `limit`
 * premières, et le curseur du dernier élément gardé s'il en reste.
 */
export function keysetSlice<T>(
  rows: readonly T[],
  limit: number,
  keyOf: (row: T) => KeysetCursor,
): KeysetResult<T> {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return {
    items,
    next: rows.length > limit && last ? keyOf(last) : null,
  };
}
