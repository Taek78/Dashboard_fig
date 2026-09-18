/*
 * Pièces jointes d'un message : photos et documents que le client ajoute à sa
 * demande dans l'application FIG.
 *
 * Depuis le 2026-09-18 (question 22 tranchée), le dashboard HÉBERGE les
 * fichiers dans la base : l'application les téléverse par l'API (règles de
 * réception dans upload.ts), le back-office les liste et les ouvre. Le
 * dashboard n'en crée ni n'en modifie jamais : un fichier vient toujours de
 * la personne qui écrit.
 *
 * La liste blanche des formats est une garde de la BASE, pas d'un
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

/**
 * Adresse d'une pièce jointe dans le back-office : la route qui sert le
 * fichier hébergé (session et rôle vérifiés), sinon l'URL externe d'une pièce
 * jointe antérieure au stockage ; null si elle n'a ni l'un ni l'autre (la
 * base l'interdit, message_attachments_one_source).
 */
export function attachmentHref(file: {
  uploadId: string | null;
  url: string | null;
}): string | null {
  if (file.uploadId !== null) {
    return `/messages/fichiers/${encodeURIComponent(file.uploadId)}`;
  }
  return file.url;
}

/** Paramètre d'URL qui force le téléchargement d'un fichier servi (?telecharger=1). */
export const DOWNLOAD_PARAM = "telecharger";

/**
 * Adresse qui TÉLÉCHARGE une pièce jointe au lieu de l'ouvrir : même route,
 * avec ?telecharger=1 pour un fichier hébergé. Une pièce antérieure garde
 * son URL externe (le navigateur décide, l'attribut download ne vaut pas
 * pour un autre domaine).
 */
export function attachmentDownloadHref(file: {
  uploadId: string | null;
  url: string | null;
}): string | null {
  const href = attachmentHref(file);
  return file.uploadId !== null && href !== null
    ? `${href}?${DOWNLOAD_PARAM}=1`
    : href;
}

/** Archive ZIP des pièces jointes hébergées d'un message (« Télécharger les pièces jointes »). */
export function attachmentsArchiveHref(messageId: string): string {
  return `/messages/${encodeURIComponent(messageId)}/pieces-jointes/archive`;
}

/** Nom du fichier ZIP : le client et le jour de réception, sans caractère à échapper. */
export function attachmentsArchiveName(message: {
  customer: { fullName: string };
  receivedAt: string;
}): string {
  const who = message.customer.fullName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `pieces-jointes-${who || "client"}-${message.receivedAt.slice(0, 10)}.zip`;
}

/** Vrai si au moins une pièce jointe est hébergée : l'archive ZIP a de quoi se remplir. */
export function hasHostedAttachment(
  attachments: readonly { uploadId: string | null }[],
): boolean {
  return attachments.some((file) => file.uploadId !== null);
}
