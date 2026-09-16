/*
 * Pièces jointes d'un message : photos et documents que le client ajoute à sa
 * demande dans l'application FIG.
 *
 * Le dashboard ne téléverse RIEN : l'application FIG stocke le fichier et écrit
 * ici son nom, son format, sa taille et son URL (question 22 : quel stockage,
 * quelles URL, quelle durée de vie). Le back-office ne fait que les lister et
 * les ouvrir.
 *
 * La liste blanche des formats est donc une garde de la BASE, pas d'un
 * formulaire : c'est l'application qui écrit, et l'enum Postgres
 * attachment_content_type refuse tout le reste — en particulier la vidéo et
 * l'audio, exclues par le client. Une liste blanche (et non une liste noire de
 * formats interdits) : ce qu'on a oublié de lister est refusé, pas accepté.
 */
export const ATTACHMENT_CONTENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/heif",
  "image/tiff",
  "image/bmp",
] as const;

export type AttachmentContentType = (typeof ATTACHMENT_CONTENT_TYPES)[number];

/** Nombre maximal de pièces jointes par message (décision client). */
export const MAX_ATTACHMENTS = 10;

/**
 * Format court affiché sur la vignette (« JPEG », « PDF »). Le type MIME
 * complet n'apprend rien à l'équipe ; il reste dans l'attribut title.
 */
export const ATTACHMENT_FORMAT_LABELS: Record<AttachmentContentType, string> = {
  "application/pdf": "PDF",
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "image/gif": "GIF",
  "image/webp": "WEBP",
  "image/avif": "AVIF",
  "image/heic": "HEIC",
  "image/heif": "HEIF",
  "image/tiff": "TIFF",
  "image/bmp": "BMP",
};

/**
 * Vrai si le fichier s'affiche en aperçu (image), faux s'il s'ouvre seulement
 * (PDF). HEIC et HEIF sont des images, mais aucun navigateur de bureau ne les
 * affiche : traitées comme des documents, sinon la vignette reste vide.
 */
export function isPreviewableImage(
  contentType: AttachmentContentType,
): boolean {
  return (
    contentType.startsWith("image/") &&
    contentType !== "image/heic" &&
    contentType !== "image/heif"
  );
}
