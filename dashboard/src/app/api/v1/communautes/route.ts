import { apiRoute, json, preflight } from "@/app/api/v1/_lib/context";
import { getMemberCounts, listCommunities } from "@/data/communities";
import { communityView } from "@/domain/api/views";
import { PUBLIC_CACHE } from "@/lib/api/etag";

/*
 * GET /api/v1/communautes : les communautés PUBLIQUES et actives, que
 * l'application propose à l'inscription ou depuis le profil (on les intègre
 * directement) ; une communauté privée n'est jamais listée (sur invitation,
 * question ouverte). Sans les coordonnées des référents. Public, cache d'une
 * minute.
 */
export const dynamic = "force-dynamic";
const METHODS = ["GET"] as const;
export const OPTIONS = preflight(METHODS);

export const GET = apiRoute(METHODS, async (call) => {
  const [communities, members] = await Promise.all([
    listCommunities(),
    getMemberCounts(),
  ]);
  const items = communities
    .filter((c) => c.active && c.visibility === "public")
    .map((c) => communityView(c, members.get(c.id) ?? 0));
  return json(call, { items, nextCursor: null }, { cache: PUBLIC_CACHE });
});
