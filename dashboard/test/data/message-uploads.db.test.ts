import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import type { DbExecutor } from "@/db/client";
import { messageAttachments, messageUploads } from "@/db/schema";
import {
  messageUploadsFixtures,
  uploadFixtureBytes,
} from "@/domain/messages/fixtures";
import { ATTACHMENT_MAX_BYTES } from "@/domain/messages/upload";

/*
 * Fichiers téléversés sur la base de TEST, chaque test dans une transaction
 * annulée : aller-retour des octets, quota des fichiers en attente, et les
 * gardes que la BASE tient seule (taille annoncée = taille réelle, 5 Mo,
 * une seule source par pièce jointe, un fichier pour une seule pièce jointe).
 */
vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () =>
  import("../support/test-database").then((m) => m.dbClientMock),
);
const { isolateEachTest, testDb } = await import("../support/test-database");
isolateEachTest();

const { messageUploadsDb } = await import("@/data/message-uploads.db");

const PNG = uploadFixtureBytes(messageUploadsFixtures[0]!);
const store = (customerId = "cli-0003") =>
  messageUploadsDb.storeUpload({
    customerId,
    fileName: "photo.png",
    contentType: "image/png",
    bytes: PNG,
  });

describe("messageUploadsDb", () => {
  it("rend les octets à l'identique, avec ses métadonnées et son propriétaire", async () => {
    const stored = await store();
    expect(stored).toMatchObject({
      customerId: "cli-0003",
      fileName: "photo.png",
      contentType: "image/png",
      sizeBytes: PNG.length,
      attachedAt: null,
    });
    const file = await messageUploadsDb.getUploadFile(stored.id);
    expect(file?.bytes).toEqual(PNG);
    expect(file?.customerId).toBe("cli-0003");
    expect(await messageUploadsDb.getUploadFile("upl-inconnu")).toBeNull();
  });

  it("les fichiers du seed sont en base, joints, avec leurs octets", async () => {
    for (const fixture of messageUploadsFixtures) {
      const file = await messageUploadsDb.getUploadFile(fixture.id);
      expect(file?.bytes).toEqual(uploadFixtureBytes(fixture));
    }
    const pending = await messageUploadsDb.countPendingUploads("cli-0001");
    expect(pending).toBe(0);
  });

  it("lit plusieurs fichiers en une fois, dans l'ordre demandé, sans les inconnus", async () => {
    const [a, b] = messageUploadsFixtures;
    const files = await messageUploadsDb.getUploadFiles([
      b!.id,
      "upl-inconnu",
      a!.id,
    ]);
    expect(files.map((f) => f.id)).toEqual([b!.id, a!.id]);
    expect(files[1]!.bytes).toEqual(uploadFixtureBytes(a!));
    expect(await messageUploadsDb.getUploadFiles([])).toEqual([]);
  });

  it("compte les seuls fichiers en attente de la personne", async () => {
    await store("cli-0003");
    await store("cli-0003");
    await store("cli-0004");
    expect(await messageUploadsDb.countPendingUploads("cli-0003")).toBe(2);
    await testDb()
      .update(messageUploads)
      .set({ attachedAt: new Date() })
      .where(eq(messageUploads.customerId, "cli-0003"));
    expect(await messageUploadsDb.countPendingUploads("cli-0003")).toBe(0);
    expect(await messageUploadsDb.countPendingUploads("cli-0004")).toBe(1);
  });
});

/**
 * Nom de la contrainte PostgreSQL qui a refusé l'écriture, sinon null. Chaque
 * essai tourne dans sa propre sous-transaction (point de sauvegarde) : une
 * écriture refusée n'abandonne pas la transaction du test.
 */
async function refusedBy(
  write: (tx: DbExecutor) => Promise<unknown>,
): Promise<string | null> {
  try {
    await testDb().transaction((tx) => write(tx));
    return null;
  } catch (error) {
    const cause = (error as { cause?: { constraint_name?: string } }).cause;
    return cause?.constraint_name ?? "erreur sans contrainte";
  }
}

describe("gardes de la base", () => {
  const row = (overrides: Partial<typeof messageUploads.$inferInsert>) => ({
    id: `upl-${crypto.randomUUID()}`,
    customerId: "cli-0003",
    fileName: "x.png",
    contentType: "image/png" as const,
    sizeBytes: PNG.length,
    bytes: Buffer.from(PNG),
    ...overrides,
  });
  const attachment = {
    messageId: "msg-0004",
    position: 0,
    fileName: "x.png",
    contentType: "image/png" as const,
    sizeBytes: PNG.length,
  };

  it("refuse une taille annoncée qui n'est pas celle des octets, et plus de 5 Mo", async () => {
    expect(
      await refusedBy((tx) =>
        tx.insert(messageUploads).values(row({ sizeBytes: PNG.length + 1 })),
      ),
    ).toBe("message_uploads_size_matches");
    const big = Buffer.alloc(ATTACHMENT_MAX_BYTES + 1);
    expect(
      await refusedBy((tx) =>
        tx
          .insert(messageUploads)
          .values(row({ sizeBytes: big.length, bytes: big })),
      ),
    ).toBe("message_uploads_size_range");
    expect(
      await refusedBy((tx) => tx.insert(messageUploads).values(row({}))),
    ).toBeNull();
  });

  it("une pièce jointe a exactement une source : un fichier hébergé OU une URL https", async () => {
    const stored = await store();
    expect(
      await refusedBy((tx) =>
        tx.insert(messageAttachments).values({ ...attachment, id: "att-rien" }),
      ),
    ).toBe("message_attachments_one_source");
    expect(
      await refusedBy((tx) =>
        tx.insert(messageAttachments).values({
          ...attachment,
          id: "att-deux",
          uploadId: stored.id,
          url: "https://ailleurs.invalid/x.png",
        }),
      ),
    ).toBe("message_attachments_one_source");
    expect(
      await refusedBy((tx) =>
        tx.insert(messageAttachments).values({
          ...attachment,
          id: "att-http",
          url: "http://ailleurs.invalid/x.png",
        }),
      ),
    ).toBe("message_attachments_url_https");
    expect(
      await refusedBy((tx) =>
        tx.insert(messageAttachments).values({
          ...attachment,
          id: "att-https",
          url: "https://ailleurs.invalid/x.png",
        }),
      ),
    ).toBeNull();
  });

  it("un fichier ne sert qu'à une pièce jointe", async () => {
    const stored = await store();
    const hosted = { ...attachment, uploadId: stored.id };
    expect(
      await refusedBy((tx) =>
        tx.insert(messageAttachments).values({ ...hosted, id: "att-a" }),
      ),
    ).toBeNull();
    expect(
      await refusedBy((tx) =>
        tx
          .insert(messageAttachments)
          .values({ ...hosted, id: "att-b", position: 1 }),
      ),
    ).toBe("message_attachments_upload_idx");
  });

  it("supprimer un fichier supprime la pièce jointe qui le cite", async () => {
    const [seeded] = messageUploadsFixtures;
    await testDb()
      .delete(messageUploads)
      .where(eq(messageUploads.id, seeded!.id));
    expect(
      await testDb()
        .select()
        .from(messageAttachments)
        .where(eq(messageAttachments.uploadId, seeded!.id)),
    ).toEqual([]);
  });
});
