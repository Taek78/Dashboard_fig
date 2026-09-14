import { communitiesFixtures } from "@/domain/communities/fixtures";
import { sortCommunities } from "@/domain/communities/rules";
import type { CommunitiesSource } from "@/domain/communities/source";
import type { Community } from "@/domain/communities/types";

/*
 * Implémentation FIXTURES du contrat CommunitiesSource (lecture seule) : Map
 * seedée, clone à la sortie, latence simulée.
 */
const store = new Map<string, Community>();
for (const c of communitiesFixtures) store.set(c.id, structuredClone(c));

export const COMMUNITIES_MOCK_LATENCY_MS = 200;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const communitiesMock: CommunitiesSource = {
  listCommunities: async () => {
    await sleep(COMMUNITIES_MOCK_LATENCY_MS);
    return structuredClone(sortCommunities([...store.values()]));
  },

  getCommunity: async (id: string) => {
    await sleep(COMMUNITIES_MOCK_LATENCY_MS);
    const community = store.get(id);
    return community ? structuredClone(community) : null;
  },
};
