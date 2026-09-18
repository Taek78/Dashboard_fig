import { describe, expect, it } from "vitest";
import {
  CUSTOMER_SESSION_TTL_MS,
  isLoginCodeUsable,
  isSessionUsable,
  LOGIN_CODE_MAX_ATTEMPTS,
  LOGIN_CODE_TTL_MS,
  loginCodeExpiresAt,
  sessionExpiresAt,
  sessionNeedsTouch,
  SESSION_TOUCH_INTERVAL_MS,
} from "@/domain/api/session";

const NOW = Date.parse("2026-09-17T12:00:00.000Z");
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

describe("codes de connexion", () => {
  it("valent dix minutes et cinq essais, une seule fois", () => {
    expect(LOGIN_CODE_TTL_MS).toBe(10 * 60_000);
    expect(LOGIN_CODE_MAX_ATTEMPTS).toBe(5);
    expect(loginCodeExpiresAt(NOW).toISOString()).toBe(iso(LOGIN_CODE_TTL_MS));
    const fresh = { expiresAt: iso(60_000), attempts: 0, consumedAt: null };
    expect(isLoginCodeUsable(fresh, NOW)).toBe(true);
    expect(isLoginCodeUsable({ ...fresh, expiresAt: iso(0) }, NOW)).toBe(false);
    expect(isLoginCodeUsable({ ...fresh, attempts: 5 }, NOW)).toBe(false);
    expect(isLoginCodeUsable({ ...fresh, consumedAt: iso(-1) }, NOW)).toBe(
      false,
    );
  });
});

describe("sessions", () => {
  it("vivent 180 jours, meurent à la révocation, et ne se touchent que toutes les dix minutes", () => {
    expect(CUSTOMER_SESSION_TTL_MS).toBe(180 * 86_400_000);
    expect(sessionExpiresAt(NOW).toISOString()).toBe(
      iso(CUSTOMER_SESSION_TTL_MS),
    );
    expect(isSessionUsable({ expiresAt: iso(1), revokedAt: null }, NOW)).toBe(
      true,
    );
    expect(isSessionUsable({ expiresAt: iso(0), revokedAt: null }, NOW)).toBe(
      false,
    );
    expect(
      isSessionUsable({ expiresAt: iso(1), revokedAt: iso(-1) }, NOW),
    ).toBe(false);
    expect(
      sessionNeedsTouch(
        { lastSeenAt: iso(-SESSION_TOUCH_INTERVAL_MS + 1) },
        NOW,
      ),
    ).toBe(false);
    expect(
      sessionNeedsTouch({ lastSeenAt: iso(-SESSION_TOUCH_INTERVAL_MS) }, NOW),
    ).toBe(true);
  });
});
