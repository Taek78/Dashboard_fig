import { crc32 } from "node:zlib";
import { describe, expect, it } from "vitest";
import { buildZip, uniqueNames } from "@/lib/zip";

/*
 * L'archive ZIP est relue par un lecteur indépendant écrit ici (répertoire
 * central → en-têtes locaux → octets), selon la spécification PKWARE : si
 * buildZip se trompait d'un octet de position ou de taille, la relecture ne
 * rendrait pas les fichiers d'origine.
 */
type Read = { name: string; bytes: Uint8Array; crc: number; flags: number };

function readZip(zip: Uint8Array): Read[] {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const end = zip.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  const out: Read[] = [];
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(at, true)).toBe(0x02014b50);
    const flags = view.getUint16(at + 8, true);
    const method = view.getUint16(at + 10, true);
    const crc = view.getUint32(at + 16, true);
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const local = view.getUint32(at + 42, true);
    const name = decoder.decode(zip.subarray(at + 46, at + 46 + nameLength));
    expect(method).toBe(0); // stockée
    expect(view.getUint32(local, true)).toBe(0x04034b50);
    const localNameLength = view.getUint16(local + 26, true);
    const start = local + 30 + localNameLength;
    out.push({ name, bytes: zip.slice(start, start + size), crc, flags });
    at += 46 + nameLength;
  }
  return out;
}

describe("buildZip", () => {
  it("rend chaque fichier à l'octet près, avec son nom UTF-8 et son CRC-32", () => {
    const entries = [
      {
        name: "fraises abîmées.png",
        bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]),
        modifiedAt: new Date(2026, 8, 8, 9, 42, 31),
      },
      {
        name: "bon.pdf",
        bytes: new TextEncoder().encode("%PDF-1.4 contenu"),
        modifiedAt: new Date(2026, 8, 8, 9, 42, 31),
      },
    ];
    const read = readZip(buildZip(entries));
    expect(read.map((r) => r.name)).toEqual(["fraises abîmées.png", "bon.pdf"]);
    for (const [i, entry] of entries.entries()) {
      expect(read[i]!.bytes).toEqual(entry.bytes);
      expect(read[i]!.crc).toBe(crc32(entry.bytes) >>> 0);
      expect(read[i]!.flags & (1 << 11)).not.toBe(0);
    }
  });

  it("une archive vide reste une archive valide (fin de répertoire seule)", () => {
    const zip = buildZip([]);
    expect(zip).toHaveLength(22);
    expect(readZip(zip)).toEqual([]);
  });

  it("commence par la signature PK", () => {
    const zip = buildZip([
      { name: "a.txt", bytes: new Uint8Array([1]), modifiedAt: new Date() },
    ]);
    expect([...zip.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });
});

describe("uniqueNames", () => {
  it("numérote les doublons, sans égard à la casse, extension gardée", () => {
    expect(
      uniqueNames(["photo.png", "photo.png", "PHOTO.png", "bon.pdf", "photo"]),
    ).toEqual([
      "photo.png",
      "photo (2).png",
      "PHOTO (3).png",
      "bon.pdf",
      "photo",
    ]);
  });

  it("ne produit jamais un nom déjà pris par un fichier suivant", () => {
    expect(uniqueNames(["a.png", "a (2).png", "a.png"])).toEqual([
      "a.png",
      "a (2).png",
      "a (3).png",
    ]);
  });
});
