import { describe, expect, it } from "vitest";
import { SlidingWindowLimiter } from "@/lib/api/throttle";

describe("SlidingWindowLimiter", () => {
  it("laisse passer `limit` requêtes par fenêtre puis refuse avec le délai avant la prochaine place", () => {
    const limiter = new SlidingWindowLimiter(3, 60_000);
    const t0 = 1_000_000;
    expect(limiter.hit("ip:a", t0)).toEqual({ allowed: true, remaining: 2 });
    expect(limiter.hit("ip:a", t0 + 10_000)).toEqual({
      allowed: true,
      remaining: 1,
    });
    expect(limiter.hit("ip:a", t0 + 20_000)).toEqual({
      allowed: true,
      remaining: 0,
    });
    expect(limiter.hit("ip:a", t0 + 30_000)).toEqual({
      allowed: false,
      retryAfterMs: 30_000,
    });
    // Un autre sujet n'est pas gêné.
    expect(limiter.hit("ip:b", t0 + 30_000).allowed).toBe(true);
    // La première requête sort de la fenêtre : une place se libère.
    expect(limiter.hit("ip:a", t0 + 60_001).allowed).toBe(true);
  });

  it("oublie les sujets inactifs pour ne pas grossir", () => {
    const limiter = new SlidingWindowLimiter(5, 1_000);
    limiter.hit("ip:a", 0);
    limiter.hit("ip:b", 500);
    expect(limiter.size).toBe(2);
    limiter.hit("ip:c", 5_000);
    expect(limiter.size).toBe(1);
  });
});
