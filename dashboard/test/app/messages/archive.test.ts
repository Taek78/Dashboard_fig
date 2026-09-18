import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  messagesFixtures,
  messageUploadsFixtures,
  uploadFixtureBytes,
} from "@/domain/messages/fixtures";

/*
 * Archive ZIP des pièces jointes d'un message (« Télécharger les pièces
 * jointes »), sur la base de test : session simulée, rôle pilotable. Le ZIP
 * rendu est relu par le répertoire central : il doit contenir exactement les
 * fichiers hébergés de CE message, dans l'ordre, à l'octet près.
 */
const session = vi.hoisted(() => ({ role: "lecture" }));
const hoisted = vi.hoisted(() => ({ logged: [] as Record<string, unknown>[] }));
vi.mock("@/data/session", () => ({
  getCurrentUser: async () => ({
    id: "usr-0003",
    name: "Lecture E2E",
    role: session.role,
  }),
}));
vi.mock("@/data/security-log", () => ({
  logSecurity: (event: Record<string, unknown>) => {
    hoisted.logged.push(event);
  },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () =>
  import("../../support/test-database").then((m) => m.dbClientMock),
);

const { isolateEachTest } = await import("../../support/test-database");
isolateEachTest();

const { GET } =
  await import("@/app/(dashboard)/messages/[id]/pieces-jointes/archive/route");

const call = (id: string, headers: Record<string, string> = {}) =>
  GET(
    new Request(`http://localhost/messages/${id}/pieces-jointes/archive`, {
      headers,
    }),
    { params: Promise.resolve({ id }) },
  );

/** Noms et octets des fichiers d'une archive stockée, lus par le répertoire central. */
function entries(zip: Uint8Array): { name: string; bytes: Uint8Array }[] {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const end = zip.length - 22;
  let at = view.getUint32(end + 16, true);
  return Array.from({ length: view.getUint16(end + 10, true) }, () => {
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const local = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(
      zip.subarray(at + 46, at + 46 + nameLength),
    );
    const start = local + 30 + view.getUint16(local + 26, true);
    at += 46 + nameLength;
    return { name, bytes: zip.slice(start, start + size) };
  });
}

beforeEach(() => {
  session.role = "lecture";
});

describe("GET /messages/[id]/pieces-jointes/archive", () => {
  it("rend un ZIP des fichiers hébergés du message, dans l'ordre, à l'octet près", async () => {
    const message = messagesFixtures.find((m) => m.id === "msg-0001")!;
    const response = await call("msg-0001", {
      "sec-fetch-site": "same-origin",
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/zip");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="pieces-jointes-amel-benali-2026-09-08.zip"',
    );
    const zip = new Uint8Array(await response.arrayBuffer());
    const expected = message.attachments.map((a) => {
      const upload = messageUploadsFixtures.find((u) => u.id === a.uploadId)!;
      return { name: upload.fileName, bytes: uploadFixtureBytes(upload) };
    });
    expect(entries(zip)).toEqual(expected);
  });

  it("404 pour un message sans pièce jointe, inconnu ou mal formé", async () => {
    expect((await call("msg-0004")).status).toBe(404);
    expect((await call("msg-9999")).status).toBe(404);
    expect((await call("x".repeat(65))).status).toBe(404);
  });

  it("refuse le livreur et une requête venue d'un autre site, et le journalise", async () => {
    session.role = "livreur";
    expect((await call("msg-0001")).status).toBe(403);
    expect(hoisted.logged.at(-1)).toMatchObject({
      type: "forbidden",
      action: "downloadMessageFiles",
    });
    session.role = "admin";
    expect(
      (await call("msg-0001", { "sec-fetch-site": "cross-site" })).status,
    ).toBe(403);
    expect(hoisted.logged.at(-1)).toMatchObject({
      action: "downloadMessageFiles:cross-site",
    });
  });
});
