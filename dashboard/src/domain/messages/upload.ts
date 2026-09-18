import {
  ATTACHMENT_CONTENT_TYPES,
  isPreviewableImage,
  type AttachmentContentType,
} from "@/domain/messages/attachment";
import { FILE_CSP } from "@/lib/csp";

/*
 * Téléversement d'une pièce jointe (2026-09-18, question 22 tranchée) : le
 * dashboard HÉBERGE désormais les fichiers, dans PostgreSQL (table
 * message_uploads). L'application FIG envoie le fichier par l'API
 * (POST /api/v1/fichiers), reçoit son identifiant, puis crée le message avec.
 *
 * Règles pures de ce qu'on accepte de recevoir et de servir :
 * - la taille (5 Mo par fichier : les octets vivent dans la base et dans
 *   chaque sauvegarde) ;
 * - le format DÉCLARÉ doit être dans la liste blanche ET être celui que
 *   révèlent les premiers octets du fichier (sa signature). Un fichier HTML
 *   renommé en .png, servi ensuite par notre propre domaine, serait une porte
 *   d'entrée pour un script : on ne croit jamais l'étiquette seule ;
 * - le nom du fichier, nettoyé avant d'entrer dans un en-tête HTTP.
 */

/** Taille maximale d'un fichier téléversé, en octets (5 Mo). */
export const ATTACHMENT_MAX_BYTES = 5_000_000;

/**
 * Fichiers en attente (téléversés, jamais joints) qu'une personne peut avoir à
 * la fois : deux messages complets. Au-delà, 429 : une session volée ne
 * remplit pas la base à 5 Mo la requête. La purge les efface après 24 h.
 */
export const MAX_PENDING_UPLOADS = 2 * 10;

/** Longueur maximale du nom de fichier gardé. */
export const ATTACHMENT_FILE_NAME_MAX_LENGTH = 200;

const startsWith = (
  bytes: Uint8Array,
  signature: readonly number[],
  offset = 0,
): boolean =>
  bytes.length >= offset + signature.length &&
  signature.every((value, i) => bytes[offset + i] === value);

const ascii = (bytes: Uint8Array, offset: number, length: number): string =>
  bytes.length >= offset + length
    ? String.fromCharCode(...bytes.subarray(offset, offset + length))
    : "";

/*
 * Marques des conteneurs ISO BMFF (boîte `ftyp`, octets 4 à 11) : AVIF et
 * HEIC / HEIF partagent le même conteneur, seule la marque les distingue.
 */
const FTYP_BRANDS: Record<string, AttachmentContentType> = {
  avif: "image/avif",
  avis: "image/avif",
  heic: "image/heic",
  heix: "image/heic",
  hevc: "image/heic",
  hevx: "image/heic",
  mif1: "image/heif",
  msf1: "image/heif",
  heim: "image/heif",
  heis: "image/heif",
};

/**
 * Format réel d'un fichier d'après ses premiers octets, parmi les formats
 * acceptés ; null si aucun ne correspond (y compris un fichier vide).
 */
export function detectAttachmentType(
  bytes: Uint8Array,
): AttachmentContentType | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return "application/pdf"; // %PDF-
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  const gif = ascii(bytes, 0, 6);
  if (gif === "GIF87a" || gif === "GIF89a") return "image/gif";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return "image/webp";
  }
  if (ascii(bytes, 4, 4) === "ftyp") {
    return FTYP_BRANDS[ascii(bytes, 8, 4)] ?? null;
  }
  if (
    startsWith(bytes, [0x49, 0x49, 0x2a, 0x00]) ||
    startsWith(bytes, [0x4d, 0x4d, 0x00, 0x2a])
  ) {
    return "image/tiff";
  }
  if (startsWith(bytes, [0x42, 0x4d])) return "image/bmp";
  return null;
}

export const ATTACHMENT_PROBLEM_CODES = [
  "file_empty",
  "file_too_large",
  "unsupported_media_type",
  "content_type_mismatch",
] as const;

export type AttachmentProblemCode = (typeof ATTACHMENT_PROBLEM_CODES)[number];

export type AttachmentProblem = {
  code: AttachmentProblemCode;
  message: string;
};

const isAcceptedType = (type: string): type is AttachmentContentType =>
  (ATTACHMENT_CONTENT_TYPES as readonly string[]).includes(type);

/** Le type déclaré, sans paramètre ni casse (« image/JPEG; x=y » → « image/jpeg »). */
export function declaredType(contentType: string): string {
  return contentType.split(";")[0]?.trim().toLowerCase() ?? "";
}

/** Issue de la vérification d'un fichier reçu : son format accepté, ou le premier problème. */
export type AttachmentCheck =
  | { ok: true; contentType: AttachmentContentType }
  | { ok: false; problem: AttachmentProblem };

/**
 * Vérifie un fichier reçu. L'ordre compte : vide, trop gros, format hors
 * liste, puis format déclaré qui n'est pas le format réel.
 */
export function checkAttachmentFile(file: {
  contentType: string;
  bytes: Uint8Array;
}): AttachmentCheck {
  const fail = (code: AttachmentProblemCode, message: string) =>
    ({ ok: false, problem: { code, message } }) as const;
  if (file.bytes.length === 0) {
    return fail("file_empty", "Le fichier est vide.");
  }
  if (file.bytes.length > ATTACHMENT_MAX_BYTES) {
    return fail(
      "file_too_large",
      `Fichier trop volumineux (${ATTACHMENT_MAX_BYTES / 1_000_000} Mo au plus).`,
    );
  }
  const declared = declaredType(file.contentType);
  if (!isAcceptedType(declared)) {
    return fail(
      "unsupported_media_type",
      "Format refusé : seuls les PDF et les images (JPEG, PNG, GIF, WebP, AVIF, HEIC, HEIF, TIFF, BMP) sont acceptés.",
    );
  }
  if (detectAttachmentType(file.bytes) !== declared) {
    return fail(
      "content_type_mismatch",
      "Le contenu du fichier ne correspond pas au format annoncé : fichier refusé.",
    );
  }
  return { ok: true, contentType: declared };
}

/**
 * Nom gardé pour un fichier : sans chemin, sans caractère de contrôle ni
 * guillemet ni barre oblique inverse (il entre dans un en-tête HTTP), espaces
 * resserrés, borné ; « fichier » s'il ne reste rien.
 */
export function safeAttachmentName(fileName: string): string {
  const base = fileName.split(/[\\/]/).at(-1) ?? "";
  const cleaned = [...base]
    .filter((c) => {
      const code = c.charCodeAt(0);
      return code >= 0x20 && code !== 0x7f && c !== '"' && c !== "\\";
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, ATTACHMENT_FILE_NAME_MAX_LENGTH)
    .trim();
  return cleaned === "" ? "fichier" : cleaned;
}

/**
 * En-tête Content-Disposition du fichier servi : une image que le navigateur
 * sait afficher s'ouvre dans l'onglet (inline) ; un PDF, un HEIC ou un HEIF se
 * TÉLÉCHARGE (attachment) : rien de ce qu'un client a envoyé ne s'exécute dans
 * une page de notre domaine. Le nom est donné deux fois : en ASCII pour les
 * vieux clients, en UTF-8 (RFC 5987) pour les accents. `download` force le
 * téléchargement d'une image (icône « Télécharger » d'une pièce jointe).
 */
export function attachmentDisposition(
  fileName: string,
  contentType: AttachmentContentType,
  { download = false }: { download?: boolean } = {},
): string {
  const name = safeAttachmentName(fileName);
  const asciiName = name.replace(/[^\x20-\x7e]/g, "_");
  const mode =
    !download && isPreviewableImage(contentType) ? "inline" : "attachment";
  return `${mode}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

/**
 * En-têtes d'un fichier servi (back-office et API) :
 * - le type STOCKÉ, vérifié au téléversement, et `nosniff` pour que le
 *   navigateur n'en devine pas un autre ;
 * - une CSP `sandbox` (FILE_CSP) : ouvert seul dans un onglet, le fichier n'a
 *   ni script ni accès à notre origine. Le proxy pose la même sur ces chemins,
 *   sinon il la remplacerait par celle des pages ;
 * - jamais en cache partagé : c'est une donnée personnelle.
 */
export function attachmentHeaders(
  file: {
    fileName: string;
    contentType: AttachmentContentType;
    sizeBytes: number;
  },
  options: { download?: boolean } = {},
): Record<string, string> {
  return {
    "Content-Type": file.contentType,
    "Content-Length": String(file.sizeBytes),
    "Content-Disposition": attachmentDisposition(
      file.fileName,
      file.contentType,
      options,
    ),
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": FILE_CSP,
    "Cache-Control": "private, no-store",
  };
}
