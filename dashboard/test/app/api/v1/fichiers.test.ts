import { describe, expect, it, vi } from "vitest";
import {
  messageUploadsFixtures,
  uploadFixtureBytes,
} from "@/domain/messages/fixtures";
import { MAX_PENDING_UPLOADS } from "@/domain/messages/upload";
import { FILE_CSP } from "@/lib/csp";
import {
  apiRequest,
  params,
  readJson,
  sessionTokenFor,
  TEST_AUTH_SECRET,
  uploadRequest,
  type UploadFile,
} from "../../../support/api";

/*
 * Téléversement et lecture des pièces jointes par l'API, sur la base de test :
 * un fichier accepté est rendu à l'octet près ; un format hors liste, un
 * contenu qui ment sur son format, un fichier vide, trop gros, sans longueur
 * annoncée, ou un quota atteint sont refusés SANS rien écrire ; un fichier ne
 * se lit que par la personne qui l'a envoyé.
 */
const hoisted = vi.hoisted(() => ({ logged: [] as Record<string, unknown>[] }));
vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () =>
  import("../../../support/test-database").then((m) => m.dbClientMock),
);
vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    DATABASE_URL: "postgresql://fig:fig@localhost:5434/fig_test",
    AUTH_SECRET: "e2e-secret-fig-dashboard-0123456789-abcdef",
  }),
}));
vi.mock("@/data/security-log", () => ({
  logSecurity: (event: Record<string, unknown>) => {
    hoisted.logged.push(event);
  },
}));

const { isolateEachTest } = await import("../../../support/test-database");
isolateEachTest();

const upload = await import("@/app/api/v1/fichiers/route");
const read = await import("@/app/api/v1/fichiers/[id]/route");
const { countPendingUploads, storeUpload } =
  await import("@/data/message-uploads");

const AMEL = "cli-0001";
const OTHER = "cli-0002";
const key = () => `cle-${crypto.randomUUID()}`;
const PNG = uploadFixtureBytes(messageUploadsFixtures[0]!);
const PDF = uploadFixtureBytes(
  messageUploadsFixtures.find((u) => u.contentType === "application/pdf")!,
);
const png = (name = "photo.png"): UploadFile => ({
  name,
  type: "image/png",
  bytes: PNG,
});

async function send(
  token: string | undefined,
  files: UploadFile[],
  headers: Record<string, string> = { "idempotency-key": key() },
) {
  return upload.POST(
    await uploadRequest("/api/v1/fichiers", { token, files, headers }),
    params({}),
  );
}

const get = (token: string, id: string) =>
  read.GET(
    apiRequest("GET", `/api/v1/fichiers/${id}`, { token }),
    params({ id }),
  );

type UploadBody = {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  url: string;
};

describe("POST /api/v1/fichiers", () => {
  it("reçoit une image, la journalise et la rend à l'octet près à son auteur", async () => {
    const token = await sessionTokenFor(AMEL, TEST_AUTH_SECRET);
    const res = await send(token, [png("mes fraises.png")]);
    expect(res.status).toBe(201);
    const body = await readJson<UploadBody>(res);
    expect(body).toMatchObject({
      fileName: "mes fraises.png",
      contentType: "image/png",
      sizeBytes: PNG.length,
      url: `/api/v1/fichiers/${body.id}`,
    });
    expect(hoisted.logged.at(-1)).toEqual({
      type: "api_file_uploaded",
      customerId: AMEL,
      uploadId: body.id,
    });

    const file = await get(token, body.id);
    expect(file.status).toBe(200);
    expect(file.headers.get("content-type")).toBe("image/png");
    expect(file.headers.get("content-disposition")).toMatch(/^inline; /);
    expect(file.headers.get("x-content-type-options")).toBe("nosniff");
    expect(file.headers.get("cache-control")).toBe("private, no-store");
    expect(file.headers.get("content-security-policy")).toBe(FILE_CSP);
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(PNG);
  });

  it("un PDF se télécharge au lieu de s'ouvrir dans l'onglet", async () => {
    const token = await sessionTokenFor(AMEL, TEST_AUTH_SECRET);
    const res = await send(token, [
      { name: "ticket.pdf", type: "application/pdf", bytes: PDF },
    ]);
    const { id } = await readJson<UploadBody>(res);
    const file = await get(token, id);
    expect(file.headers.get("content-disposition")).toMatch(
      /^attachment; filename="ticket.pdf"/,
    );
  });

  it("refuse sans rien écrire : format hors liste, contenu qui ment, fichier vide", async () => {
    const token = await sessionTokenFor(AMEL, TEST_AUTH_SECRET);
    const before = await countPendingUploads(AMEL);
    const html = new TextEncoder().encode("<script>alert(1)</script>");
    const cases: [UploadFile, number, string][] = [
      [
        { name: "a.svg", type: "image/svg+xml", bytes: html },
        415,
        "unsupported_media_type",
      ],
      [
        { name: "a.png", type: "image/png", bytes: html },
        422,
        "content_type_mismatch",
      ],
      [
        { name: "a.pdf", type: "application/pdf", bytes: PNG },
        422,
        "content_type_mismatch",
      ],
      [
        { name: "vide.png", type: "image/png", bytes: new Uint8Array() },
        422,
        "file_empty",
      ],
    ];
    for (const [file, status, code] of cases) {
      const res = await send(token, [file]);
      expect(res.status, code).toBe(status);
      expect((await readJson(res)).error).toMatchObject({ code });
      expect(hoisted.logged.at(-1)).toEqual({
        type: "api_file_rejected",
        customerId: AMEL,
        reason: code,
      });
    }
    expect(await countPendingUploads(AMEL)).toBe(before);
  });

  it("refuse avant de lire : pas de session, pas de multipart, pas de longueur, trop gros, zéro ou deux fichiers", async () => {
    const token = await sessionTokenFor(AMEL, TEST_AUTH_SECRET);
    expect((await send(undefined, [png()])).status).toBe(401);

    const json = await upload.POST(
      apiRequest("POST", "/api/v1/fichiers", {
        token,
        body: { fichier: "x" },
        headers: { "idempotency-key": key() },
      }),
      params({}),
    );
    expect(json.status).toBe(415);

    const noLength = await uploadRequest("/api/v1/fichiers", {
      token,
      files: [png()],
    });
    const headers = new Headers(noLength.headers);
    headers.delete("content-length");
    const withoutLength = await upload.POST(
      new Request(noLength.url, {
        method: "POST",
        headers,
        body: await noLength.arrayBuffer(),
      }),
      params({}),
    );
    expect(withoutLength.status).toBe(411);
    expect((await readJson(withoutLength)).error).toMatchObject({
      code: "length_required",
    });

    const huge = await send(token, [png()], {
      "idempotency-key": key(),
      "content-length": String(6_000_000),
    });
    expect(huge.status).toBe(413);
    const garbled = await send(token, [png()], {
      "idempotency-key": key(),
      "content-length": "beaucoup",
    });
    expect(garbled.status).toBe(411);

    expect((await send(token, [])).status).toBe(422);
    expect((await send(token, [png("a.png"), png("b.png")])).status).toBe(422);
    expect(await countPendingUploads(AMEL)).toBe(0);
  });

  it("exige une clé d'idempotence et rejoue le même envoi sans second fichier", async () => {
    const token = await sessionTokenFor(AMEL, TEST_AUTH_SECRET);
    expect((await send(token, [png()], {})).status).toBe(400);

    const k = key();
    const first = await send(token, [png()], { "idempotency-key": k });
    const again = await send(token, [png()], { "idempotency-key": k });
    expect(again.status).toBe(201);
    expect(again.headers.get("Idempotent-Replayed")).toBe("true");
    expect((await readJson<UploadBody>(again)).id).toBe(
      (await readJson<UploadBody>(first)).id,
    );
    expect(await countPendingUploads(AMEL)).toBe(1);

    // Même clé, autre fichier : refusé.
    const other = await send(token, [png("autre.png")], {
      "idempotency-key": k,
    });
    expect(other.status).toBe(422);
  });

  it(`refuse au-delà de ${MAX_PENDING_UPLOADS} fichiers en attente (429)`, async () => {
    const token = await sessionTokenFor(AMEL, TEST_AUTH_SECRET);
    for (let i = 0; i < MAX_PENDING_UPLOADS; i++) {
      await storeUpload({
        customerId: AMEL,
        fileName: `p${i}.png`,
        contentType: "image/png",
        bytes: PNG,
      });
    }
    const res = await send(token, [png()]);
    expect(res.status).toBe(429);
    expect((await readJson(res)).error).toMatchObject({
      code: "upload_quota_exceeded",
    });
    expect(await countPendingUploads(AMEL)).toBe(MAX_PENDING_UPLOADS);
  });
});

describe("GET /api/v1/fichiers/{id}", () => {
  it("le fichier d'une autre personne ou inconnu répond 404, comme s'il n'existait pas", async () => {
    const token = await sessionTokenFor(AMEL, TEST_AUTH_SECRET);
    const foreign = messageUploadsFixtures.find((u) => u.customerId === OTHER)!;
    expect((await get(token, foreign.id)).status).toBe(404);
    expect((await get(token, "upl-inconnu")).status).toBe(404);
    const theirs = await sessionTokenFor(OTHER, TEST_AUTH_SECRET);
    expect((await get(theirs, foreign.id)).status).toBe(200);
  });
});
