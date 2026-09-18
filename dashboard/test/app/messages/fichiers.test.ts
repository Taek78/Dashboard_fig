import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  messageUploadsFixtures,
  uploadFixtureBytes,
} from "@/domain/messages/fixtures";

/*
 * Route du back-office qui sert une pièce jointe hébergée, sur la base de
 * test : session simulée (rôle pilotable), refus journalisé pour le livreur
 * et pour une requête venue d'un autre site, image affichée, PDF téléchargé.
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

const { GET } = await import("@/app/(dashboard)/messages/fichiers/[id]/route");

const call = (id: string, headers: Record<string, string> = {}) =>
  GET(new Request(`http://localhost/messages/fichiers/${id}`, { headers }), {
    params: Promise.resolve({ id }),
  });

const photo = messageUploadsFixtures.find(
  (u) => u.contentType === "image/png",
)!;
const pdf = messageUploadsFixtures.find(
  (u) => u.contentType === "application/pdf",
)!;

beforeEach(() => {
  session.role = "lecture";
});

describe("GET /messages/fichiers/[id]", () => {
  it("quiconque lit la boîte de réception voit l'image, à l'octet près, jamais en cache", async () => {
    for (const role of ["admin", "gestionnaire", "lecture"]) {
      session.role = role;
      const response = await call(photo.id, {
        "sec-fetch-site": "same-origin",
      });
      expect(response.status, role).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/png");
      expect(response.headers.get("content-disposition")).toBe(
        `inline; filename="${photo.fileName}"; filename*=UTF-8''${photo.fileName}`,
      );
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(
        uploadFixtureBytes(photo),
      );
    }
  });

  it("un PDF se télécharge", async () => {
    const response = await call(pdf.id);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toMatch(
      /^attachment; filename="bon-de-livraison.pdf"/,
    );
  });

  it("?telecharger=1 télécharge une image au lieu de l'afficher (icône de la tuile)", async () => {
    const response = await GET(
      new Request(
        `http://localhost/messages/fichiers/${photo.id}?telecharger=1`,
      ),
      { params: Promise.resolve({ id: photo.id }) },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toMatch(
      new RegExp(`^attachment; filename="${photo.fileName}"`),
    );
    // Toute autre valeur garde l'affichage.
    const other = await GET(
      new Request(
        `http://localhost/messages/fichiers/${photo.id}?telecharger=oui`,
      ),
      { params: Promise.resolve({ id: photo.id }) },
    );
    expect(other.headers.get("content-disposition")).toMatch(/^inline;/);
  });

  it("refuse le livreur et une requête venue d'un autre site, et le journalise", async () => {
    session.role = "livreur";
    const driver = await call(photo.id);
    expect(driver.status).toBe(403);
    expect(hoisted.logged.at(-1)).toMatchObject({
      type: "forbidden",
      action: "readMessageFile",
    });

    session.role = "admin";
    const hotlink = await call(photo.id, { "sec-fetch-site": "cross-site" });
    expect(hotlink.status).toBe(403);
    expect(await hotlink.text()).not.toContain("PNG");
    expect(hoisted.logged.at(-1)).toMatchObject({
      action: "readMessageFile:cross-site",
    });
  });

  it("404 pour un fichier inconnu ou un identifiant invalide", async () => {
    expect((await call("upl-9999")).status).toBe(404);
    expect((await call("x".repeat(65))).status).toBe(404);
  });
});
