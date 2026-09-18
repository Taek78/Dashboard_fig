import "server-only";
import { randomUUID } from "node:crypto";
import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { toMessageUpload } from "@/db/mappers";
import { messageUploads } from "@/db/schema";
import type { MessageUploadsSource } from "@/domain/messages/source";
import type { MessageUploadFile } from "@/domain/messages/types";

/*
 * Implémentation Drizzle du contrat MessageUploadsSource. Les octets partent
 * en bytea (Buffer) ; la base refuse d'elle-même une taille annoncée qui ne
 * serait pas celle des octets, et tout fichier de plus de 5 Mo.
 */
const fileColumns = {
  id: messageUploads.id,
  customerId: messageUploads.customerId,
  fileName: messageUploads.fileName,
  contentType: messageUploads.contentType,
  sizeBytes: messageUploads.sizeBytes,
  bytes: messageUploads.bytes,
};

const toFile = (row: {
  id: string;
  customerId: string;
  fileName: string;
  contentType: MessageUploadFile["contentType"];
  sizeBytes: number;
  bytes: Buffer;
}): MessageUploadFile => ({ ...row, bytes: new Uint8Array(row.bytes) });

export const messageUploadsDb: MessageUploadsSource = {
  storeUpload: async (input) => {
    const bytes = Buffer.from(input.bytes);
    const [row] = await getDb()
      .insert(messageUploads)
      .values({
        id: randomUUID(),
        customerId: input.customerId,
        fileName: input.fileName,
        contentType: input.contentType,
        sizeBytes: bytes.length,
        bytes,
      })
      .returning({
        id: messageUploads.id,
        customerId: messageUploads.customerId,
        fileName: messageUploads.fileName,
        contentType: messageUploads.contentType,
        sizeBytes: messageUploads.sizeBytes,
        createdAt: messageUploads.createdAt,
        attachedAt: messageUploads.attachedAt,
      });
    if (!row) throw new Error("Fichier inséré introuvable.");
    return toMessageUpload(row);
  },

  countPendingUploads: async (customerId) => {
    const [row] = await getDb()
      .select({ n: count() })
      .from(messageUploads)
      .where(
        and(
          eq(messageUploads.customerId, customerId),
          isNull(messageUploads.attachedAt),
        ),
      );
    return row?.n ?? 0;
  },

  getUploadFile: async (id) => {
    const [row] = await getDb()
      .select(fileColumns)
      .from(messageUploads)
      .where(eq(messageUploads.id, id));
    return row ? toFile(row) : null;
  },

  getUploadFiles: async (ids) => {
    if (ids.length === 0) return [];
    const rows = await getDb()
      .select(fileColumns)
      .from(messageUploads)
      .where(inArray(messageUploads.id, [...ids]));
    const byId = new Map(rows.map((row) => [row.id, toFile(row)]));
    return ids.flatMap((id) => byId.get(id) ?? []);
  },
};
