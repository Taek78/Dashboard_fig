import { crc32 } from "node:zlib";

/*
 * Archive ZIP « stockée » (sans compression), écrite à la main : de quoi
 * remettre en un seul fichier les pièces jointes d'un message. Photos et PDF
 * sont déjà compressés, les recompresser ne gagnerait presque rien. Pas de
 * bibliothèque pour 80 lignes : le format se réduit ici à un en-tête local
 * par fichier, suivi de ses octets, puis un répertoire central et sa fin.
 *
 * Limites assumées : pas de ZIP64 (moins de 4 Go et de 65 535 fichiers, dix
 * pièces jointes de 5 Mo au plus ici), noms en UTF-8 (drapeau 11).
 */
export type ZipEntry = { name: string; bytes: Uint8Array; modifiedAt: Date };

const UTF8_FLAG = 1 << 11;

/** Date et heure au format MS-DOS (heure locale du serveur, précision de deux secondes). */
function dosDateTime(date: Date): { time: number; day: number } {
  const year = Math.min(Math.max(date.getFullYear(), 1980), 2107);
  return {
    time:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      Math.floor(date.getSeconds() / 2),
    day: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

export function buildZip(entries: readonly ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.bytes) >>> 0;
    const size = entry.bytes.length;
    const { time, day } = dosDateTime(entry.modifiedAt);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); // signature d'en-tête local
    local.setUint16(4, 20, true); // version nécessaire (2.0)
    local.setUint16(6, UTF8_FLAG, true);
    local.setUint16(8, 0, true); // méthode : stockée
    local.setUint16(10, time, true);
    local.setUint16(12, day, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, size, true); // taille compressée
    local.setUint32(22, size, true); // taille d'origine
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true); // pas de champ supplémentaire
    locals.push(new Uint8Array(local.buffer), name, entry.bytes);

    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true); // signature du répertoire central
    central.setUint16(4, 20, true); // version qui a créé l'archive
    central.setUint16(6, 20, true); // version nécessaire
    central.setUint16(8, UTF8_FLAG, true);
    central.setUint16(10, 0, true);
    central.setUint16(12, time, true);
    central.setUint16(14, day, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, size, true);
    central.setUint32(24, size, true);
    central.setUint16(28, name.length, true);
    // 30 : champ supplémentaire, 32 : commentaire, 34 : disque, 36 et 38 :
    // attributs internes et externes, tous à zéro.
    central.setUint32(42, offset, true); // position de l'en-tête local
    centrals.push(new Uint8Array(central.buffer), name);

    offset += 30 + name.length + size;
  }

  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); // fin du répertoire central
  end.setUint16(8, entries.length, true); // entrées sur ce disque
  end.setUint16(10, entries.length, true); // entrées au total
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true); // début du répertoire central

  const parts = [...locals, ...centrals, new Uint8Array(end.buffer)];
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/**
 * Noms uniques dans une archive, dans l'ordre : le second « photo.png »
 * devient « photo (2).png » (deux entrées du même nom, et l'outil de
 * décompression écraserait la première).
 */
export function uniqueNames(names: readonly string[]): string[] {
  const taken = new Set<string>();
  return names.map((name) => {
    const dot = name.lastIndexOf(".");
    const [stem, ext] =
      dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
    let candidate = name;
    for (let n = 2; taken.has(candidate.toLowerCase()); n++) {
      candidate = `${stem} (${n})${ext}`;
    }
    taken.add(candidate.toLowerCase());
    return candidate;
  });
}
