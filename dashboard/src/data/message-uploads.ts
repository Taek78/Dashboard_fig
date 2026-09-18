import "server-only";
import { messageUploadsDb } from "@/data/message-uploads.db";
import type { MessageUploadsSource } from "@/domain/messages/source";

/*
 * FAÇADE des fichiers joints aux messages : téléversement par l'API, lecture
 * par le back-office et par l'API. Implémentation PostgreSQL
 * (message-uploads.db.ts), octets en bytea.
 */
export const {
  storeUpload,
  countPendingUploads,
  getUploadFile,
  getUploadFiles,
}: MessageUploadsSource = messageUploadsDb;
