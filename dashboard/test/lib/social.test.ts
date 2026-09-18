import { describe, expect, it } from "vitest";
import {
  SOCIAL_HOMES,
  SOCIAL_LINKS,
  SOCIAL_NETWORKS,
  socialHref,
  socialLinkLabel,
} from "@/lib/social";

const EMPTY = { facebook: "", instagram: "" };

describe("socialHref", () => {
  it("rend l'adresse renseignée en https", () => {
    const links = { facebook: " https://www.facebook.com/fig ", instagram: "" };
    expect(socialHref("facebook", links)).toBe("https://www.facebook.com/fig");
  });

  it("jamais de lien mort : vide ou invalide, c'est la page d'accueil du réseau", () => {
    for (const url of [
      "",
      "http://www.facebook.com/fig",
      "javascript:alert(1)",
      "www.instagram.com/fig",
      "https://www.instagram.com/f ig",
    ]) {
      expect(socialHref("instagram", { ...EMPTY, instagram: url })).toBe(
        "https://www.instagram.com/",
      );
    }
    expect(socialHref("facebook", EMPTY)).toBe("https://www.facebook.com/");
  });

  it("Facebook et Instagram seulement, chacun avec une adresse en https", () => {
    expect(SOCIAL_NETWORKS).toEqual(["facebook", "instagram"]);
    for (const network of SOCIAL_NETWORKS) {
      expect(socialHref(network)).toMatch(/^https:\/\//);
      expect(SOCIAL_HOMES[network]).toMatch(/^https:\/\/www\./);
    }
    expect(Object.keys(SOCIAL_LINKS)).toEqual(["facebook", "instagram"]);
  });
});

describe("socialLinkLabel", () => {
  it("ne promet la page de FIG que si elle est renseignée", () => {
    expect(socialLinkLabel("facebook", EMPTY)).toBe("Facebook (nouvel onglet)");
    expect(
      socialLinkLabel("facebook", {
        ...EMPTY,
        facebook: "https://www.facebook.com/fig",
      }),
    ).toBe("FIG sur Facebook (nouvel onglet)");
  });
});
