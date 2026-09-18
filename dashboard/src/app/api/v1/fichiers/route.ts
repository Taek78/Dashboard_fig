import { createHash } from "node:crypto";
import { requireCustomer } from "@/app/api/v1/_lib/auth";
import { apiRoute, preflight } from "@/app/api/v1/_lib/context";
import { withIdempotency } from "@/app/api/v1/_lib/idempotency";
import { countPendingUploads, storeUpload } from "@/data/message-uploads";
import { logSecurity } from "@/data/security-log";
import { uploadView } from "@/domain/api/views";
import {
  ATTACHMENT_MAX_BYTES,
  MAX_PENDING_UPLOADS,
  checkAttachmentFile,
  declaredType,
  safeAttachmentName,
  type AttachmentProblemCode,
} from "@/domain/messages/upload";
import { ApiError } from "@/lib/api/errors";

/*
 * POST /api/v1/fichiers (Idempotency-Key obligatoire) : téléverse UNE pièce
 * jointe, en multipart/form-data, champ `fichier`. Réponse 201 avec son
 * identifiant, à citer ensuite dans `fileIds` de POST /messages.
 *
 * Tout est vérifié AVANT d'écrire : session → taille annoncée (411 sans
 * Content-Length, 413 au-delà : le corps n'est pas lu) → quota de fichiers en
 * attente (429) → lecture → taille réelle, format de la liste blanche, et
 * format RÉEL d'après les premiers octets (checkAttachmentFile) → écriture
 * → journal. Un refus est journalisé avec son motif, jamais avec le nom du
 * fichier (donnée de la personne).
 */
export const dynamic = "force-dynamic";
const METHODS = ["POST"] as const;
export const OPTIONS = preflight(METHODS);

/** Marge du multipart autour du fichier : délimiteurs et en-têtes de partie. */
const MULTIPART_OVERHEAD_BYTES = 16 * 1024;

const PROBLEM_STATUS: Record<AttachmentProblemCode, number> = {
  file_empty: 422,
  file_too_large: 413,
  unsupported_media_type: 415,
  content_type_mismatch: 422,
};

const PROBLEM_API_CODE = {
  file_empty: "file_empty",
  file_too_large: "payload_too_large",
  unsupported_media_type: "unsupported_media_type",
  content_type_mismatch: "content_type_mismatch",
} as const satisfies Record<AttachmentProblemCode, string>;

async function readUploadedFile(request: Request): Promise<File> {
  const type = request.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data\s*;/i.test(type.trim())) {
    throw new ApiError(
      415,
      "unsupported_media_type",
      "Le fichier doit être envoyé en multipart/form-data, champ « fichier ».",
    );
  }
  // Absent ou illisible (« abc » vaudrait NaN, qui passerait la comparaison) : 411.
  const length = Number(request.headers.get("content-length") ?? Number.NaN);
  if (!Number.isInteger(length) || length < 0) {
    throw new ApiError(
      411,
      "length_required",
      "L'en-tête Content-Length est obligatoire pour un téléversement.",
    );
  }
  if (length > ATTACHMENT_MAX_BYTES + MULTIPART_OVERHEAD_BYTES) {
    throw new ApiError(
      413,
      "payload_too_large",
      `Fichier trop volumineux (${ATTACHMENT_MAX_BYTES / 1_000_000} Mo au plus).`,
    );
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new ApiError(
      400,
      "bad_request",
      "Corps multipart illisible : un champ « fichier » est attendu.",
    );
  }
  const files = form.getAll("fichier");
  const file = files[0];
  if (files.length !== 1 || !(file instanceof File)) {
    throw new ApiError(
      422,
      "validation_failed",
      "Un et un seul fichier est attendu, dans le champ « fichier ».",
    );
  }
  return file;
}

export const POST = apiRoute(METHODS, async (call) => {
  const { customer } = await requireCustomer(call);
  const file = await readUploadedFile(call.request);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const fileName = safeAttachmentName(file.name);
  const fingerprint = [
    createHash("sha256").update(bytes).digest("hex"),
    declaredType(file.type),
    fileName,
  ].join("\n");

  return withIdempotency(call, customer.id, fingerprint, async () => {
    const check = checkAttachmentFile({ contentType: file.type, bytes });
    if (!check.ok) {
      const { problem } = check;
      logSecurity({
        type: "api_file_rejected",
        customerId: customer.id,
        reason: problem.code,
      });
      throw new ApiError(
        PROBLEM_STATUS[problem.code],
        PROBLEM_API_CODE[problem.code],
        problem.message,
      );
    }
    if ((await countPendingUploads(customer.id)) >= MAX_PENDING_UPLOADS) {
      logSecurity({
        type: "api_file_rejected",
        customerId: customer.id,
        reason: "upload_quota_exceeded",
      });
      throw new ApiError(
        429,
        "upload_quota_exceeded",
        `Trop de fichiers en attente (${MAX_PENDING_UPLOADS}) : joignez-les à un message, ou patientez 24 heures.`,
      );
    }
    const upload = await storeUpload({
      customerId: customer.id,
      fileName,
      contentType: check.contentType,
      bytes,
    });
    logSecurity({
      type: "api_file_uploaded",
      customerId: customer.id,
      uploadId: upload.id,
    });
    return { status: 201, body: uploadView(upload) };
  });
});
