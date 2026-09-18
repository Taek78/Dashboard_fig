import { describe, expect, it } from "vitest";
import {
  ATTACHMENT_CONTENT_TYPES,
  attachmentDownloadHref,
  attachmentHref,
  attachmentsArchiveHref,
  attachmentsArchiveName,
  hasHostedAttachment,
} from "@/domain/messages/attachment";
import {
  messageUploadsFixtures,
  uploadFixtureBytes,
} from "@/domain/messages/fixtures";
import {
  ATTACHMENT_FILE_NAME_MAX_LENGTH,
  ATTACHMENT_MAX_BYTES,
  attachmentDisposition,
  attachmentHeaders,
  checkAttachmentFile,
  declaredType,
  detectAttachmentType,
  safeAttachmentName,
} from "@/domain/messages/upload";
import { FILE_CSP } from "@/lib/csp";

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string, padTo = 0) => {
  const out = new Uint8Array(Math.max(text.length, padTo));
  out.set(new TextEncoder().encode(text));
  return out;
};
/** Un en-tête ISO BMFF : taille de boîte, « ftyp », marque. */
const ftyp = (brand: string) =>
  ascii(`\u0000\u0000\u0000\u0018ftyp${brand}`, 16);

describe("detectAttachmentType", () => {
  it("reconnaît chaque format de la liste blanche à sa signature", () => {
    const samples: [Uint8Array, string][] = [
      [ascii("%PDF-1.7"), "application/pdf"],
      [bytes(0xff, 0xd8, 0xff, 0xe0), "image/jpeg"],
      [bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), "image/png"],
      [ascii("GIF87a"), "image/gif"],
      [ascii("GIF89a"), "image/gif"],
      [ascii("RIFF\u0000\u0000\u0000\u0000WEBP"), "image/webp"],
      [ftyp("avif"), "image/avif"],
      [ftyp("heic"), "image/heic"],
      [ftyp("mif1"), "image/heif"],
      [bytes(0x49, 0x49, 0x2a, 0x00), "image/tiff"],
      [bytes(0x4d, 0x4d, 0x00, 0x2a), "image/tiff"],
      [bytes(0x42, 0x4d, 0x00), "image/bmp"],
    ];
    for (const [sample, type] of samples) {
      expect(detectAttachmentType(sample), type).toBe(type);
    }
    // Chaque format accepté a au moins un échantillon.
    expect(new Set(samples.map(([, type]) => type))).toEqual(
      new Set(ATTACHMENT_CONTENT_TYPES),
    );
  });

  it("ne reconnaît ni HTML, ni SVG, ni vidéo, ni un conteneur ISO d'une autre marque, ni un fichier tronqué", () => {
    expect(detectAttachmentType(ascii("<html><script>"))).toBeNull();
    expect(detectAttachmentType(ascii("<svg xmlns="))).toBeNull();
    expect(detectAttachmentType(ftyp("isom"))).toBeNull(); // MP4
    expect(detectAttachmentType(bytes(0xff, 0xd8))).toBeNull();
    expect(
      detectAttachmentType(ascii("RIFF\u0000\u0000\u0000\u0000WAVE")),
    ).toBeNull();
    expect(detectAttachmentType(new Uint8Array())).toBeNull();
  });

  it("les fichiers du seed ont la signature de leur format annoncé", () => {
    for (const upload of messageUploadsFixtures) {
      expect(detectAttachmentType(uploadFixtureBytes(upload))).toBe(
        upload.contentType,
      );
    }
  });
});

describe("checkAttachmentFile", () => {
  const png = uploadFixtureBytes(messageUploadsFixtures[0]!);

  it("accepte un fichier dont le contenu est le format annoncé, paramètres et casse ignorés", () => {
    expect(
      checkAttachmentFile({ contentType: "Image/PNG; x=y", bytes: png }),
    ).toEqual({ ok: true, contentType: "image/png" });
  });

  it("dans l'ordre : vide, trop gros, format hors liste, contenu qui ment", () => {
    const code = (contentType: string, data: Uint8Array) => {
      const check = checkAttachmentFile({ contentType, bytes: data });
      return check.ok ? null : check.problem.code;
    };
    expect(code("image/svg+xml", new Uint8Array())).toBe("file_empty");
    const big = new Uint8Array(ATTACHMENT_MAX_BYTES + 1);
    big.set(png);
    expect(code("video/mp4", big)).toBe("file_too_large");
    expect(code("image/svg+xml", ascii("<svg>"))).toBe(
      "unsupported_media_type",
    );
    expect(code("text/html", ascii("<html>"))).toBe("unsupported_media_type");
    expect(code("image/jpeg", png)).toBe("content_type_mismatch");
    expect(code("image/png", ascii("<script>"))).toBe("content_type_mismatch");
  });

  it("la limite est incluse : 5 Mo pile passent", () => {
    const exact = new Uint8Array(ATTACHMENT_MAX_BYTES);
    exact.set(png);
    expect(
      checkAttachmentFile({ contentType: "image/png", bytes: exact }).ok,
    ).toBe(true);
  });
});

describe("declaredType", () => {
  it("garde le type seul, en minuscules", () => {
    expect(declaredType(" image/JPEG ; charset=x")).toBe("image/jpeg");
    expect(declaredType("")).toBe("");
  });
});

describe("safeAttachmentName", () => {
  it("retire le chemin, les caractères de contrôle, les guillemets et les barres obliques inverses", () => {
    expect(safeAttachmentName("C:\\Users\\moi\\photo.png")).toBe("photo.png");
    expect(safeAttachmentName("../../etc/passwd")).toBe("passwd");
    expect(safeAttachmentName('a"b\r\nContent-Type: x.png')).toBe(
      "abContent-Type: x.png",
    );
    expect(safeAttachmentName("  mes   fraises.png ")).toBe("mes fraises.png");
  });

  it("borne la longueur et nomme « fichier » ce qui ne garde rien", () => {
    expect(safeAttachmentName("a".repeat(500))).toHaveLength(
      ATTACHMENT_FILE_NAME_MAX_LENGTH,
    );
    expect(safeAttachmentName("")).toBe("fichier");
    expect(safeAttachmentName('"\\/')).toBe("fichier");
  });
});

describe("attachmentDisposition et attachmentHeaders", () => {
  it("affiche une image que le navigateur sait lire, télécharge le reste", () => {
    expect(attachmentDisposition("a.png", "image/png")).toMatch(/^inline;/);
    expect(attachmentDisposition("a.pdf", "application/pdf")).toMatch(
      /^attachment;/,
    );
    expect(attachmentDisposition("a.heic", "image/heic")).toMatch(
      /^attachment;/,
    );
  });

  it("donne le nom en ASCII et en UTF-8", () => {
    expect(attachmentDisposition("abîmé.png", "image/png")).toBe(
      `inline; filename="ab_m_.png"; filename*=UTF-8''ab%C3%AEm%C3%A9.png`,
    );
  });

  it("interdit la devinette de type et le cache partagé", () => {
    expect(
      attachmentHeaders({
        fileName: "a.png",
        contentType: "image/png",
        sizeBytes: 125,
      }),
    ).toMatchObject({
      "Content-Type": "image/png",
      "Content-Length": "125",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": FILE_CSP,
      "Cache-Control": "private, no-store",
    });
  });
});

describe("attachmentHref", () => {
  it("un fichier hébergé passe par la route du back-office, une pièce antérieure garde son URL", () => {
    expect(attachmentHref({ uploadId: "upl-0001", url: null })).toBe(
      "/messages/fichiers/upl-0001",
    );
    expect(
      attachmentHref({ uploadId: null, url: "https://ailleurs.invalid/a.png" }),
    ).toBe("https://ailleurs.invalid/a.png");
    expect(attachmentHref({ uploadId: null, url: null })).toBeNull();
  });
});

describe("téléchargement et visualisation", () => {
  const hosted = { uploadId: "upl-0001", url: null };
  const legacy = { uploadId: null, url: "https://ailleurs.invalid/a.png" };

  it("une image se télécharge sur demande, sans changer ce qui ne s'affiche pas", () => {
    expect(
      attachmentDisposition("a.png", "image/png", { download: true }),
    ).toMatch(/^attachment;/);
    expect(
      attachmentDisposition("a.pdf", "application/pdf", { download: true }),
    ).toMatch(/^attachment;/);
    expect(
      attachmentHeaders(
        { fileName: "a.png", contentType: "image/png", sizeBytes: 1 },
        { download: true },
      )["Content-Disposition"],
    ).toMatch(/^attachment;/);
  });

  it("l'icône « Télécharger » d'un fichier hébergé ajoute ?telecharger=1, une pièce antérieure garde son URL", () => {
    expect(attachmentDownloadHref(hosted)).toBe(
      "/messages/fichiers/upl-0001?telecharger=1",
    );
    expect(attachmentDownloadHref(legacy)).toBe(legacy.url);
    expect(attachmentDownloadHref({ uploadId: null, url: null })).toBeNull();
  });

  it("l'archive a son adresse sous le message", () => {
    expect(attachmentsArchiveHref("msg-0001")).toBe(
      "/messages/msg-0001/pieces-jointes/archive",
    );
  });

  it("l'archive se nomme d'après le client, sans accent, et le jour de réception", () => {
    expect(
      attachmentsArchiveName({
        customer: { fullName: "Amel Benali-Dupré" },
        receivedAt: "2026-09-08T07:42:00.000Z",
      }),
    ).toBe("pieces-jointes-amel-benali-dupre-2026-09-08.zip");
    expect(
      attachmentsArchiveName({
        customer: { fullName: "" },
        receivedAt: "2026-09-08T07:42:00.000Z",
      }),
    ).toBe("pieces-jointes-client-2026-09-08.zip");
  });

  it("l'archive n'est proposée que s'il y a au moins un fichier hébergé", () => {
    expect(hasHostedAttachment([legacy, hosted])).toBe(true);
    expect(hasHostedAttachment([legacy])).toBe(false);
    expect(hasHostedAttachment([])).toBe(false);
  });
});
