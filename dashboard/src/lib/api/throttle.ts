import { RATE_LIMIT_WINDOW_MS } from "@/domain/api/types";

/*
 * Limitation de débit EN MÉMOIRE de l'API (règle pure, horloge en paramètre) :
 * une fenêtre glissante par sujet (adresse IP, session). Elle protège une
 * instance contre un appelant qui martèle ; l'état n'est pas partagé entre
 * instances (la garde partagée en base reste celle des codes de connexion,
 * login_attempts). Les sujets inactifs sont oubliés à chaque passage, pour
 * que la mémoire ne grandisse pas.
 */
export type ThrottleDecision =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterMs: number };

export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs = RATE_LIMIT_WINDOW_MS,
  ) {}

  /** Compte la requête et dit si elle passe. */
  hit(subject: string, now: number): ThrottleDecision {
    this.prune(now);
    const since = now - this.windowMs;
    const recent = (this.hits.get(subject) ?? []).filter((t) => t > since);
    if (recent.length >= this.limit) {
      this.hits.set(subject, recent);
      return { allowed: false, retryAfterMs: recent[0]! + this.windowMs - now };
    }
    recent.push(now);
    this.hits.set(subject, recent);
    return { allowed: true, remaining: this.limit - recent.length };
  }

  /** Oublie les sujets sans requête dans la fenêtre (au plus une fois par seconde). */
  private lastPrune = 0;
  private prune(now: number): void {
    if (now - this.lastPrune < 1000) return;
    this.lastPrune = now;
    const since = now - this.windowMs;
    for (const [subject, times] of this.hits) {
      if (times.every((t) => t <= since)) this.hits.delete(subject);
    }
  }

  /** Nombre de sujets suivis (tests). */
  get size(): number {
    return this.hits.size;
  }
}
