import { describe, expect, it } from "vitest";
import { SOCIAL_LINKS, SOCIAL_NETWORKS, socialHref } from "@/lib/social";

describe("socialHref", () => {
  it("rend l'adresse renseignée en https, sinon null (icône inactive)", () => {
    const links = {
      facebook: " https://www.facebook.com/fig ",
      instagram: "",
    };
    expect(socialHref("facebook", links)).toBe("https://www.facebook.com/fig");
    expect(socialHref("instagram", links)).toBeNull();
  });

  it("refuse une adresse qui n'est pas en https ou qui contient un espace", () => {
    for (const url of [
      "http://www.facebook.com/fig",
      "javascript:alert(1)",
      "www.instagram.com/fig",
      "https://www.instagram.com/f ig",
    ]) {
      expect(socialHref("instagram", { facebook: "", instagram: url })).toBe(
        null,
      );
    }
  });

  it("Facebook et Instagram seulement, chacun avec une adresse vide ou en https", () => {
    expect(SOCIAL_NETWORKS).toEqual(["facebook", "instagram"]);
    for (const network of SOCIAL_NETWORKS) {
      const url = SOCIAL_LINKS[network];
      expect(url === "" || socialHref(network) === url.trim()).toBe(true);
    }
  });
});
