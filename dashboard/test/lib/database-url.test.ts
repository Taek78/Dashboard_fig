import { describe, expect, it } from "vitest";
import {
  databaseHost,
  isLocalDatabase,
  remoteDatabaseProblem,
} from "@/lib/database-url";

describe("databaseHost / isLocalDatabase", () => {
  it("lit l'hôte, crochets IPv6 retirés, et reconnaît les hôtes locaux", () => {
    expect(databaseHost("postgresql://fig:fig@localhost:5432/fig")).toBe(
      "localhost",
    );
    expect(databaseHost("postgresql://fig:fig@[::1]:5432/fig")).toBe("::1");
    expect(
      isLocalDatabase("postgresql://fig:fig@127.0.0.1:5434/fig_test"),
    ).toBe(true);
    expect(isLocalDatabase("postgresql://fig:fig@[::1]:5432/fig")).toBe(true);
    expect(
      isLocalDatabase("postgresql://fig:fig@db.example.invalid:5432/fig"),
    ).toBe(false);
    // Un sous-domaine qui imite un hôte local n'est pas local.
    expect(
      isLocalDatabase("postgresql://fig@localhost.example.invalid/fig"),
    ).toBe(false);
  });
});

describe("remoteDatabaseProblem", () => {
  const remote = "postgresql://fig:secret@db.example.invalid:5432/fig";

  it("laisse passer une base locale, ou une base distante explicitement permise", () => {
    expect(
      remoteDatabaseProblem(
        "postgresql://fig@localhost/fig",
        "SEED_ALLOW_REMOTE",
        {},
        "le seed",
      ),
    ).toBeNull();
    expect(
      remoteDatabaseProblem(
        remote,
        "SEED_ALLOW_REMOTE",
        { SEED_ALLOW_REMOTE: "1" },
        "le seed",
      ),
    ).toBeNull();
  });

  it("refuse une base distante avec l'hôte, l'usage et la variable, jamais le mot de passe", () => {
    const problem = remoteDatabaseProblem(
      remote,
      "RGPD_ALLOW_REMOTE",
      { RGPD_ALLOW_REMOTE: "0" },
      "la purge",
    );
    expect(problem).toBe(
      "Hôte db.example.invalid refusé : la purge ne vise qu'une base locale (RGPD_ALLOW_REMOTE=1 pour forcer).",
    );
    expect(problem).not.toContain("secret");
  });
});
