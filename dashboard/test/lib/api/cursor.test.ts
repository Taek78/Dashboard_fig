import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor, keysetSlice } from "@/lib/api/cursor";

describe("curseur des listes", () => {
  it("fait l'aller-retour et refuse tout ce qui n'est pas un curseur", () => {
    const cursor = { at: "2026-09-17T10:00:00.000Z", id: "cmd-0001" };
    const encoded = encodeCursor(cursor);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCursor(encoded)).toEqual(cursor);
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor("")).toBeNull();
    expect(decodeCursor("pas-du-base64-json")).toBeNull();
    expect(
      decodeCursor(Buffer.from('{"at":"hier","id":"x"}').toString("base64url")),
    ).toBeNull();
    expect(
      decodeCursor(Buffer.from('{"id":"x"}').toString("base64url")),
    ).toBeNull();
    expect(
      decodeCursor(Buffer.from('["a","b"]').toString("base64url")),
    ).toBeNull();
  });

  it("keysetSlice garde `limit` lignes et pointe le curseur suivant seulement s'il en reste", () => {
    const rows = [
      { at: "2026-09-17T10:00:00.000Z", id: "c" },
      { at: "2026-09-16T10:00:00.000Z", id: "b" },
      { at: "2026-09-15T10:00:00.000Z", id: "a" },
    ];
    const key = (r: (typeof rows)[number]) => ({ at: r.at, id: r.id });
    expect(keysetSlice(rows, 2, key)).toEqual({
      items: rows.slice(0, 2),
      next: { at: "2026-09-16T10:00:00.000Z", id: "b" },
    });
    expect(keysetSlice(rows, 3, key)).toEqual({ items: rows, next: null });
    expect(keysetSlice([], 3, key)).toEqual({ items: [], next: null });
  });
});
