import { describe, expect, it } from "vitest";
import { etagMatches, etagOf, PUBLIC_CACHE } from "@/lib/api/etag";

describe("ETag des lectures publiques", () => {
  it("dépend du corps seulement et se compare avec ou sans le préfixe faible", () => {
    const etag = etagOf('{"a":1}');
    expect(etag).toMatch(/^W\/"[0-9a-f]{32}"$/);
    expect(etagOf('{"a":1}')).toBe(etag);
    expect(etagOf('{"a":2}')).not.toBe(etag);
    expect(etagMatches(etag, etag)).toBe(true);
    expect(etagMatches(etag.slice(2), etag)).toBe(true);
    expect(etagMatches(`"autre", ${etag}`, etag)).toBe(true);
    expect(etagMatches("*", etag)).toBe(true);
    expect(etagMatches(null, etag)).toBe(false);
    expect(etagMatches('"autre"', etag)).toBe(false);
  });

  it("annonce un cache public d'une minute, revalidable cinq", () => {
    expect(PUBLIC_CACHE).toBe("public, max-age=60, stale-while-revalidate=300");
  });
});
