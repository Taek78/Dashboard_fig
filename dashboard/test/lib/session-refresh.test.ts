import { describe, expect, it } from "vitest";
import {
  isBackgroundPoll,
  isPrefetch,
  refreshDue,
  SESSION_MAX_AGE_SECONDS,
  stripSessionCookies,
} from "@/lib/session-refresh";

describe("isPrefetch", () => {
  it("reconnaît un préchargement du routeur Next ou du navigateur", () => {
    expect(isPrefetch(new Headers({ "next-router-prefetch": "1" }))).toBe(true);
    expect(
      isPrefetch(new Headers({ "sec-purpose": "prefetch;prerender" })),
    ).toBe(true);
    expect(isPrefetch(new Headers({ purpose: "prefetch" }))).toBe(true);
    expect(isPrefetch(new Headers({ rsc: "1" }))).toBe(false);
    expect(isPrefetch(new Headers())).toBe(false);
  });
});

describe("isBackgroundPoll", () => {
  it("le relevé des alertes ne renouvelle jamais la session, les pages si", () => {
    expect(isBackgroundPoll("/alertes")).toBe(true);
    expect(isBackgroundPoll("/alertes/x")).toBe(false);
    // Suivi de l'envoi d'une notification, relu toutes les 3 s.
    expect(isBackgroundPoll("/notifications/ntf-1")).toBe(true);
    expect(isBackgroundPoll("/notifications")).toBe(false);
    expect(isBackgroundPoll("/commandes")).toBe(false);
    expect(isBackgroundPoll("/")).toBe(false);
  });
});

describe("refreshDue", () => {
  const now = Date.parse("2026-09-14T12:00:00.000Z");
  const expOf = (ageSeconds: number) =>
    now / 1000 - ageSeconds + SESSION_MAX_AGE_SECONDS;

  it("un jeton récent n'est pas renouvelé, un jeton à mi-vie l'est", () => {
    expect(refreshDue(expOf(60), now)).toBe(false);
    expect(refreshDue(expOf(3 * 3600), now)).toBe(false);
    expect(refreshDue(expOf(4 * 3600), now)).toBe(true);
    expect(refreshDue(expOf(7 * 3600), now)).toBe(true);
  });

  it("sans expiration lisible, on laisse Auth.js rafraîchir", () => {
    expect(refreshDue(undefined, now)).toBe(true);
    expect(refreshDue(Number.NaN, now)).toBe(true);
  });
});

describe("stripSessionCookies", () => {
  it("retire seulement les cookies de session, garde les autres, en place", () => {
    const headers = new Headers();
    headers.append("set-cookie", "authjs.session-token=abc; Path=/; HttpOnly");
    headers.append("set-cookie", "authjs.csrf-token=xyz; Path=/");
    headers.append(
      "set-cookie",
      "__Secure-authjs.session-token=def; Path=/; Secure",
    );
    headers.append("set-cookie", "authjs.callback-url=%2F; Path=/");
    expect(stripSessionCookies(headers)).toBe(2);
    expect(headers.getSetCookie()).toEqual([
      "authjs.csrf-token=xyz; Path=/",
      "authjs.callback-url=%2F; Path=/",
    ]);
  });

  it("laisse passer la SUPPRESSION du cookie de session (session refusée)", () => {
    const headers = new Headers();
    headers.append(
      "set-cookie",
      "authjs.session-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly",
    );
    headers.append("set-cookie", "authjs.session-token=abc; Path=/; HttpOnly");
    expect(stripSessionCookies(headers)).toBe(1);
    expect(headers.getSetCookie()).toEqual([
      "authjs.session-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly",
    ]);
  });

  it("ne touche à rien sans cookie de session", () => {
    const headers = new Headers({ "content-type": "text/html" });
    headers.append("set-cookie", "authjs.csrf-token=xyz; Path=/");
    expect(stripSessionCookies(headers)).toBe(0);
    expect(headers.getSetCookie()).toEqual(["authjs.csrf-token=xyz; Path=/"]);
  });
});
