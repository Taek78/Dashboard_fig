import { describe, expect, it } from "vitest";
import { corsHeaders } from "@/lib/api/cors";

describe("corsHeaders", () => {
  const allowed = ["https://app.fig.invalid", "http://localhost:5173"];

  it("ne renvoie rien sans origine, hors liste ou sans liste", () => {
    expect(corsHeaders(null, allowed, ["GET"])).toEqual({});
    expect(corsHeaders("https://autre.invalid", allowed, ["GET"])).toEqual({});
    expect(corsHeaders("https://app.fig.invalid", [], ["GET"])).toEqual({});
  });

  it("renvoie l'origine exacte, les méthodes, les en-têtes et Vary pour une origine admise", () => {
    const headers = corsHeaders("http://localhost:5173", allowed, [
      "GET",
      "POST",
    ]);
    expect(headers["Access-Control-Allow-Origin"]).toBe(
      "http://localhost:5173",
    );
    expect(headers["Access-Control-Allow-Methods"]).toBe("GET, POST, OPTIONS");
    expect(headers["Access-Control-Allow-Headers"]).toContain(
      "Idempotency-Key",
    );
    expect(headers["Access-Control-Expose-Headers"]).toContain("ETag");
    expect(headers.Vary).toBe("Origin");
    expect(headers["Access-Control-Allow-Credentials"]).toBeUndefined();
  });
});
