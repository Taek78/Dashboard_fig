import { describe, expect, it } from "vitest";
import {
  checkAttempt,
  clientIpFrom,
  EMAIL_POLICY,
  formatRetryDelay,
  recordFailure,
  strictest,
  type AttemptState,
} from "@/lib/rate-limit";

const MINUTE = 60_000;

describe("recordFailure / checkAttempt", () => {
  it("verrouille au cinquième échec rapproché, puis double à chaque échec, plafonné à 1 h", () => {
    let state: AttemptState | undefined;
    const t0 = 1_000_000;
    for (let i = 0; i < 4; i++) {
      state = recordFailure(state, t0 + i * 1000, EMAIL_POLICY);
      expect(checkAttempt(state, t0 + i * 1000 + 1)).toEqual({ allowed: true });
    }
    state = recordFailure(state, t0 + 5000, EMAIL_POLICY);
    expect(checkAttempt(state, t0 + 5001)).toEqual({
      allowed: false,
      retryAfterMs: MINUTE - 1,
    });
    state = recordFailure(state, t0 + 6000, EMAIL_POLICY);
    expect(state.lockedUntil).toBe(t0 + 6000 + 2 * MINUTE);
    for (let i = 0; i < 12; i++) {
      state = recordFailure(state, t0 + 7000 + i, EMAIL_POLICY);
    }
    expect(state.lockedUntil! - (t0 + 7000 + 11)).toBe(60 * MINUTE);
  });

  it("un échec longtemps après le précédent repart de zéro", () => {
    let state = recordFailure(undefined, 0, EMAIL_POLICY);
    state = recordFailure(state, 1000, EMAIL_POLICY);
    expect(state.failures).toBe(2);
    state = recordFailure(
      state,
      1000 + EMAIL_POLICY.windowMs + 1,
      EMAIL_POLICY,
    );
    expect(state.failures).toBe(1);
    expect(state.lockedUntil).toBeNull();
  });

  it("un verrou expiré laisse passer", () => {
    const state: AttemptState = {
      failures: 5,
      lastFailureAt: 0,
      lockedUntil: MINUTE,
    };
    expect(checkAttempt(state, MINUTE - 1).allowed).toBe(false);
    expect(checkAttempt(state, MINUTE).allowed).toBe(true);
    expect(checkAttempt(undefined, 0).allowed).toBe(true);
  });
});

describe("strictest", () => {
  it("garde le refus le plus long, sinon autorise", () => {
    expect(strictest([{ allowed: true }, { allowed: true }])).toEqual({
      allowed: true,
    });
    expect(
      strictest([
        { allowed: false, retryAfterMs: 10 },
        { allowed: true },
        { allowed: false, retryAfterMs: 30 },
      ]),
    ).toEqual({ allowed: false, retryAfterMs: 30 });
  });
});

describe("formatRetryDelay", () => {
  it("arrondit vers le haut en minutes puis en heures", () => {
    expect(formatRetryDelay(1)).toBe("1 minute");
    expect(formatRetryDelay(2 * MINUTE + 1)).toBe("3 minutes");
    expect(formatRetryDelay(60 * MINUTE)).toBe("1 heure");
    expect(formatRetryDelay(61 * MINUTE)).toBe("2 heures");
  });
});

describe("clientIpFrom", () => {
  it("lit la première adresse de X-Forwarded-For, sinon X-Real-IP, sinon inconnue", () => {
    expect(
      clientIpFrom(new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" })),
    ).toBe("203.0.113.5");
    expect(clientIpFrom(new Headers({ "x-real-ip": "198.51.100.7" }))).toBe(
      "198.51.100.7",
    );
    expect(clientIpFrom(new Headers())).toBe("inconnue");
  });
});
